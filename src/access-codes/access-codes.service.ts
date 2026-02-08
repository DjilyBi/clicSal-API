import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { nanoid } from 'nanoid';

@Injectable()
export class AccessCodesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Générer un nouveau code QR dynamic
   * code_value = identifiant unique du QR
   * share_token = identifiant permanent pour refresher
   */
  async generateAccessCode(userId: string, membershipOrPassId: string, isMembership: boolean = true) {
    const codeValue = `acc_${nanoid(20)}`; // Nouveau code unique
    const shareToken = `token_${nanoid(32)}`; // Token permanent pour refresh

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1); // Expire dans 1h

    if (isMembership) {
      return this.prisma.accessCode.create({
        data: {
          codeValue,
          shareToken,
          membershipId: membershipOrPassId,
          userId,
          expiresAt,
        },
      });
    } else {
      return this.prisma.accessCode.create({
        data: {
          codeValue,
          shareToken,
          sessionPassId: membershipOrPassId,
          userId,
          expiresAt,
        },
      });
    }
  }

  /**
   * Récupérer le QR code courant à afficher
   * Utilisé par l'app mobile pour afficher le code
   */
  async getDisplayCode(userId: string) {
    // Récupérer le dernier access code non-expiré de cet user
    const accessCode = await this.prisma.accessCode.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() }, // Non expiré
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });

    if (!accessCode) {
      throw new NotFoundException('Aucun QR code valide. Veuillez recharger votre abonnement.');
    }

    return {
      codeValue: accessCode.codeValue,
      expiresAt: accessCode.expiresAt,
      refreshUrl: `/access-codes/refresh?shareToken=${accessCode.shareToken}`,
    };
  }

  /**
   * Rafraîchir le QR code manuellement
   * L'app mobile peut appeler cela si le code est proche de l'expiration
   */
  async refreshAccessCode(shareToken: string) {
    // Trouver l'access code par share token
    const oldAccessCode = await this.prisma.accessCode.findUnique({
      where: { shareToken },
    });

    if (!oldAccessCode) {
      throw new NotFoundException('Share token invalide');
    }

    // Générer nouveau code_value
    const newCodeValue = `acc_${nanoid(20)}`;
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 1);

    // Updater l'accès code existant avec nouveau code_value
    const updated = await this.prisma.accessCode.update({
      where: { id: oldAccessCode.id },
      data: {
        codeValue: newCodeValue,
        expiresAt,
      },
    });

    return {
      message: 'QR code rafraîchi ✅',
      codeValue: updated.codeValue,
      expiresAt: updated.expiresAt,
    };
  }

  /**
   * Cron job pour expirer les vieux access codes
   * Tourne chaque heure
   */
  @Cron(CronExpression.EVERY_HOUR)
  async expireOldAccessCodes() {
    const now = new Date();

    const deleted = await this.prisma.accessCode.deleteMany({
      where: {
        expiresAt: { lte: now },
      },
    });

    console.log(`[QR Cleanup] Expired ${deleted.count} old access codes`);
    return deleted;
  }

  /**
   * Cron job pour rafraîchir les codes proches de l'expiration
   * Tourne toutes les 30 minutes
   * Auto-refresh des codes si < 10 min avant expiration
   */
  @Cron('*/30 * * * *')
  async autoRefreshExpiringCodes() {
    const soon = new Date();
    soon.setMinutes(soon.getMinutes() + 10); // Codes qui vont expirer dans 10 min

    const expiringCodes = await this.prisma.accessCode.findMany({
      where: {
        expiresAt: {
          lte: soon,
          gt: new Date(), // Pas encore expiré
        },
      },
    });

    let refreshedCount = 0;

    for (const code of expiringCodes) {
      const newCodeValue = `acc_${nanoid(20)}`;
      const newExpiresAt = new Date();
      newExpiresAt.setHours(newExpiresAt.getHours() + 1);

      await this.prisma.accessCode.update({
        where: { id: code.id },
        data: {
          codeValue: newCodeValue,
          expiresAt: newExpiresAt,
        },
      });

      refreshedCount++;
    }

    if (refreshedCount > 0) {
      console.log(`[QR Auto-Refresh] Refreshed ${refreshedCount} codes about to expire`);
    }

    return { refreshedCount };
  }

  /**
   * Pour les tests : créer manuellement un access code
   * Admin peut utiliser pour déboguer
   */
  async createAccessCodeForUser(userId: string, membershipId?: string, sessionPassId?: string) {
    if (!membershipId && !sessionPassId) {
      throw new BadRequestException('Either membershipId or sessionPassId required');
    }

    return this.generateAccessCode(
      userId,
      membershipId || sessionPassId,
      !!membershipId,
    );
  }

  /**
   * Récupérer tous les codes QR actifs d'un user
   * Utile pour le dashboard
   */
  async getUserAccessCodes(userId: string) {
    return this.prisma.accessCode.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      include: {
        membership: true,
        sessionPass: true,
      },
    });
  }

  /**
   * Supprimer un access code (si révoqué)
   */
  async revokeAccessCode(codeId: string) {
    return this.prisma.accessCode.delete({
      where: { id: codeId },
    });
  }
}
