import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInType, MembershipStatus } from '@prisma/client';
import { ScanQRDto, ExitValidationDto } from './dto/check-in.dto';
import { nanoid } from 'nanoid';

@Injectable()
export class CheckInsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Valider un scan QR à l'entrée
   * - Vérifie que le code existe et n'est pas expiré
   * - Appelle la fonction anti-fraude check_duplicate_checkin()
   * - Crée un check-in entry
   */
  async validateEntry(gymId: string, codeValue: string, staffId?: string) {
    // 1. Trouver le code QR
    const accessCode = await this.prisma.accessCode.findUnique({
      where: { codeValue },
      include: {
        user: true,
        membership: true,
        sessionPass: true,
      },
    });

    if (!accessCode) {
      throw new NotFoundException('QR code invalide');
    }

    // 2. Vérifier que le code n'est pas expiré
    if (accessCode.expiresAt < new Date()) {
      throw new BadRequestException('QR code expiré');
    }

    // 3. Anti-fraude : Vérifier qu'on peut entrer (pas déjà en salle)
    // Appel à la fonction SQL check_duplicate_checkin()
    const canEnter = await this.checkDuplicateEntry(accessCode.id, gymId);

    if (!canEnter) {
      throw new ConflictException('Accès refusé : Vous êtes déjà dans la salle');
    }

    // 4. Vérifier que l'accès est valide pour ce gym
    if (accessCode.membership) {
      const membership = await this.prisma.membership.findUnique({
        where: { id: accessCode.membership.id },
      });

      if (membership.gymId !== gymId) {
        throw new BadRequestException('Membership non valide pour ce gym');
      }

      if (membership.status !== MembershipStatus.active) {
        throw new ConflictException(
          `Membership ${membership.status} - Veuillez renouveler`,
        );
      }
    }

    // 5. Créer le check-in entry
    const checkIn = await this.prisma.checkIn.create({
      data: {
        gymId,
        userId: accessCode.userId,
        accessCodeId: accessCode.id,
        type: CheckInType.entry,
        validatedByStaffId: staffId, // Staff qui a scanné
        scannedAt: new Date(),
      },
      include: {
        user: true,
        accessCode: true,
      },
    });

    return {
      message: 'Accès autorisé ✅',
      checkIn,
      user: {
        id: checkIn.user?.id,
        firstName: checkIn.user?.firstName,
        lastName: checkIn.user?.lastName,
        photoUrl: checkIn.user?.photoUrl,
      },
    };
  }

  /**
   * Valider une sortie via QR code fixe
   * - Trouve le dernier check-in entry sans exit
   * - Crée un check-in exit automatique
   */
  async validateExit(gymId: string, exitQRCode: string) {
    // 1. Trouver le gym via le code de sortie
    const gym = await this.prisma.gym.findUnique({
      where: { exitQrCode: exitQRCode },
    });

    if (!gym || gym.id !== gymId) {
      throw new NotFoundException('QR code de sortie invalide');
    }

    // 2. Récupérer tous les check-ins d'aujourd'hui sans sortie
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const unfinishedCheckIns = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        type: CheckInType.entry,
        scannedAt: { gte: today },
        // Pas de check-in exit correspondant
        NOT: {
          accessCode: {
            checkIns: {
              some: {
                type: CheckInType.exit,
                scannedAt: { gte: today },
              },
            },
          },
        },
      },
      include: { user: true, accessCode: true },
      orderBy: { scannedAt: 'desc' },
      take: 1,
    });

    // 3. Si pas de check-in ouvert, refuser la sortie
    if (unfinishedCheckIns.length === 0) {
      throw new BadRequestException('Aucune entrée active détectée');
    }

    // 4. Créer le check-in exit
    const lastEntry = unfinishedCheckIns[0];
    const exitCheckIn = await this.prisma.checkIn.create({
      data: {
        gymId,
        userId: lastEntry.userId,
        accessCodeId: lastEntry.accessCodeId,
        type: CheckInType.exit,
        scannedAt: new Date(),
      },
      include: { user: true },
    });

    return {
      message: 'Bonne journée ! ✅',
      exitCheckIn,
      user: {
        id: exitCheckIn.user?.id,
        firstName: exitCheckIn.user?.firstName,
        lastName: exitCheckIn.user?.lastName,
      },
    };
  }

  /**
   * Fonction anti-fraude : Vérifier qu'on peut entrer
   * Equivalent de check_duplicate_checkin() en SQL
   */
  private async checkDuplicateEntry(accessCodeId: string, gymId: string): Promise<boolean> {
    // Récupérer le dernier check-in pour ce code QR
    const lastEntry = await this.prisma.checkIn.findFirst({
      where: {
        accessCodeId,
        gymId,
        type: CheckInType.entry,
      },
      orderBy: { scannedAt: 'desc' },
      take: 1,
    });

    // Pas d'entrée avant = OK (première fois)
    if (!lastEntry) {
      return true;
    }

    // Une entrée existe, vérifier s'il y a une sortie après
    const exitAfter = await this.prisma.checkIn.findFirst({
      where: {
        accessCodeId,
        gymId,
        type: CheckInType.exit,
        scannedAt: { gt: lastEntry.scannedAt },
      },
      orderBy: { scannedAt: 'desc' },
      take: 1,
    });

    // S'il y a une sortie après l'entrée = OK (peut réentrer)
    // S'il n'y a pas de sortie = NOK (déjà en salle)
    return !!exitAfter;
  }

  /**
   * Récupérer le statut check-in actuel d'un user dans un gym
   */
  async getUserCheckInStatus(userId: string, gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestCheckIn = await this.prisma.checkIn.findFirst({
      where: {
        userId,
        gymId,
        scannedAt: { gte: today },
      },
      orderBy: { scannedAt: 'desc' },
      take: 1,
    });

    if (!latestCheckIn) {
      return { status: 'not_entered', message: 'Pas encore entré aujourd\'hui' };
    }

    return {
      status: latestCheckIn.type === CheckInType.entry ? 'in_gym' : 'exited',
      message:
        latestCheckIn.type === CheckInType.entry
          ? 'Actuellement dans la salle'
          : 'Sorti de la salle',
      timestamp: latestCheckIn.scannedAt,
    };
  }

  /**
   * Récupérer la list des users actuellement en salle
   */
  async getCurrentlyInGym(gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Récupérer tous les check-ins d'aujourd'hui
    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        scannedAt: { gte: today },
      },
      include: { user: true },
      orderBy: { scannedAt: 'desc' },
    });

    // Calculer qui est encore en salle (dernière action = entry)
    const usersInGym = new Map();

    for (const checkIn of checkIns) {
      if (!usersInGym.has(checkIn.userId)) {
        usersInGym.set(checkIn.userId, {
          id: checkIn.userId,
          firstName: checkIn.user?.firstName,
          lastName: checkIn.user?.lastName,
          photoUrl: checkIn.user?.photoUrl,
          enteredAt: undefined,
          lastAction: undefined,
        });
      }

      const user = usersInGym.get(checkIn.userId);

      if (checkIn.type === CheckInType.entry) {
        user.enteredAt = checkIn.scannedAt;
        user.lastAction = 'entry';
      } else {
        user.lastAction = 'exit';
      }
    }

    // Filtrer pour garder que ceux qui sont en salle (dernière action = entry)
    const inGym = Array.from(usersInGym.values()).filter(
      (user) => user.lastAction === 'entry',
    );

    return {
      count: inGym.length,
      users: inGym,
    };
  }

  /**
   * Récupérer les statistiques check-in du jour
   */
  async getDailyStats(gymId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkIns = await this.prisma.checkIn.findMany({
      where: {
        gymId,
        scannedAt: { gte: today },
      },
    });

    const entries = checkIns.filter((c) => c.type === CheckInType.entry).length;
    const exits = checkIns.filter((c) => c.type === CheckInType.exit).length;

    return {
      date: today,
      totalEntries: entries,
      totalExits: exits,
      currentlyInGym: entries - exits,
    };
  }
}
