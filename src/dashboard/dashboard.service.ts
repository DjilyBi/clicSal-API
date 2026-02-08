import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  GetMembersDto,
  GetPaymentsDto,
  MemberResponseDto,
  PaymentResponseDto,
  DashboardStatsDto,
} from './dto/dashboard.dto';
import { MembershipStatus, PaymentStatus } from '@prisma/client';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Récupérer tous les membres avec filtres
   * Filtres disponibles: active | expired | expiring_soon | all
   */
  async getMembers(
    gymId: string,
    dto: GetMembersDto,
  ): Promise<{ members: MemberResponseDto[]; total: number }> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Construire la clause WHERE selon le filtre
    let statusFilter: any = {};
    if (dto.filter === 'active') {
      statusFilter = {
        status: 'active',
        endDate: { gt: now },
      };
    } else if (dto.filter === 'expired') {
      statusFilter = {
        status: 'expired',
        endDate: { lte: now },
      };
    } else if (dto.filter === 'expiring_soon') {
      statusFilter = {
        status: 'active',
        endDate: {
          gt: now,
          lte: sevenDaysFromNow,
        },
      };
    }

    const searchFilter = dto.search
      ? {
          OR: [
            { firstName: { contains: dto.search, mode: 'insensitive' } },
            { lastName: { contains: dto.search, mode: 'insensitive' } },
            { phone: { contains: dto.search } },
          ],
        }
      : {};

    // Récupérer les memberships filtrés
    const memberships = await this.prisma.membership.findMany({
      where: {
        gymId,
        ...statusFilter,
        user: searchFilter,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            photoUrl: true,
          },
        },
      },
      take: dto.limit,
      skip: dto.offset,
      orderBy: { endDate: 'desc' },
    });

    // Calculer le nombre de jours jusqu'à l'expiration
    const members: MemberResponseDto[] = await Promise.all(
      memberships.map(async (m) => {
        const lastCheckIn = await this.prisma.checkIn.findFirst({
          where: {
            gymId,
            userId: m.userId,
            type: 'entry',
          },
          orderBy: { scannedAt: 'desc' },
          take: 1,
        });

        const daysUntilExpiry = Math.ceil(
          (m.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );

        return {
          id: m.user.id,
          firstName: m.user.firstName || '',
          lastName: m.user.lastName || '',
          phone: m.user.phone,
          photoUrl: m.user.photoUrl,
          membership: {
            id: m.id,
            type: m.type,
            status: m.status,
            startDate: m.startDate,
            endDate: m.endDate,
            daysUntilExpiry,
          },
          lastCheckIn: lastCheckIn
            ? {
                scannedAt: lastCheckIn.scannedAt,
                type: lastCheckIn.type,
              }
            : undefined,
        };
      }),
    );

    // Compter le total pour la pagination
    const total = await this.prisma.membership.count({
      where: {
        gymId,
        ...statusFilter,
        user: searchFilter,
      },
    });

    return { members, total };
  }

  /**
   * Récupérer l'historique des paiements avec filtres
   */
  async getPaymentHistory(
    gymId: string,
    dto: GetPaymentsDto,
  ): Promise<{ payments: PaymentResponseDto[]; total: number; totalAmount: number }> {
    const now = new Date();
    let dateFilter: any = {};

    if (dto.period === 'today') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      dateFilter = { gte: startOfDay, lte: now };
    } else if (dto.period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: weekAgo, lte: now };
    } else if (dto.period === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      dateFilter = { gte: monthAgo, lte: now };
    }

    const whereClause: any = {
      gymId,
      createdAt: dateFilter,
    };

    if (dto.type) {
      whereClause.paymentType = dto.type;
    }

    if (dto.status) {
      whereClause.status = dto.status;
    }

    // Récupérer les paiements
    const payments = await this.prisma.payment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            phone: true,
          },
        },
      },
      take: dto.limit,
      skip: dto.offset,
      orderBy: { createdAt: 'desc' },
    });

    // Récupérer le montant total
    const totalAmount = await this.prisma.payment.aggregate({
      where: {
        ...whereClause,
        status: 'paid',
      },
      _sum: { amount: true },
    });

    const paymentResponses: PaymentResponseDto[] = payments.map((p) => ({
      id: p.id,
      user: p.user
        ? {
            id: p.user.id,
            firstName: p.user.firstName || '',
            phone: p.user.phone,
          }
        : undefined,
      paymentType: p.paymentType,
      amount: Number(p.amount),
      method: p.method,
      status: p.status,
      createdAt: p.createdAt,
    }));

    const total = await this.prisma.payment.count({
      where: whereClause,
    });

    return {
      payments: paymentResponses,
      total,
      totalAmount: totalAmount._sum.amount
        ? Number(totalAmount._sum.amount)
        : 0,
    };
  }

  /**
   * Récupérer les utilisateurs actuellement en salle
   */
  async getCurrentlyInGym(gymId: string): Promise<any[]> {
    const usersInGym = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        type: 'entry',
        scannedAt: {
          // Depuis le début de la journée
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
        // Vérifier qu'il n'y a pas d'exit après
        user: {
          checkIns: {
            none: {
              gymId,
              type: 'exit',
              scannedAt: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
              },
            },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            photoUrl: true,
          },
        },
      },
      orderBy: { scannedAt: 'desc' },
    });

    return usersInGym.map((c) => ({
      id: c.user?.id,
      firstName: c.user?.firstName || 'Anonyme',
      lastName: c.user?.lastName || '',
      phone: c.user?.phone || 'N/A',
      photoUrl: c.user?.photoUrl,
      enteredAt: c.scannedAt,
      type: c.type,
    }));
  }

  /**
   * Récupérer les statistiques du dashboard
   */
  async getStats(gymId: string): Promise<DashboardStatsDto> {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Compter les membres par statut
    const totalMembers = await this.prisma.membership.count({
      where: { gymId },
      distinct: ['userId'],
    });

    const activeMembers = await this.prisma.membership.count({
      where: {
        gymId,
        status: 'active',
        endDate: { gt: now },
      },
      distinct: ['userId'],
    });

    const expiredMembers = await this.prisma.membership.count({
      where: {
        gymId,
        status: 'expired',
        endDate: { lte: now },
      },
      distinct: ['userId'],
    });

    const expiringNext7Days = await this.prisma.membership.count({
      where: {
        gymId,
        status: 'active',
        endDate: {
          gt: now,
          lte: sevenDaysFromNow,
        },
      },
      distinct: ['userId'],
    });

    // Revenus totaux
    const totalRevenue = await this.prisma.payment.aggregate({
      where: {
        gymId,
        status: 'paid',
      },
      _sum: { amount: true },
    });

    // Revenus par type
    const revenueByType = await this.prisma.payment.groupBy({
      by: ['paymentType'],
      where: {
        gymId,
        status: 'paid',
      },
      _sum: { amount: true },
    });

    // Revenus par méthode
    const revenueByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        gymId,
        status: 'paid',
      },
      _sum: { amount: true },
    });

    // Utilisateurs actuellement en salle
    const currentlyInGym = await this.prisma.checkIn.count({
      where: {
        gymId,
        type: 'entry',
        scannedAt: { gte: startOfDay },
        user: {
          checkIns: {
            none: {
              gymId,
              type: 'exit',
              scannedAt: { gte: startOfDay },
            },
          },
        },
      },
    });

    // Total check-ins aujourd'hui
    const totalCheckinsToday = await this.prisma.checkIn.count({
      where: {
        gymId,
        type: 'entry',
        scannedAt: { gte: startOfDay },
      },
    });

    const revenueBreakdown: any = {
      byType: {},
      byMethod: {},
    };

    revenueByType.forEach((item) => {
      revenueBreakdown.byType[item.paymentType] = Number(
        item._sum.amount || 0,
      );
    });

    revenueByMethod.forEach((item) => {
      revenueBreakdown.byMethod[item.method] = Number(
        item._sum.amount || 0,
      );
    });

    return {
      totalMembers,
      activeMembers,
      expiredMembers,
      expiringNext7Days,
      totalRevenue: Number(totalRevenue._sum.amount || 0),
      revenueBreakdown,
      currentlyInGym,
      totalCheckinsToday,
    };
  }
}
