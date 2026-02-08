import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService, private jwtService: JwtService) {}

  /**
   * Créer une nouvelle session pour un utilisateur
   * Invalide les anciennes sessions du même device
   */
  async createSession(
    userId: string,
    deviceId: string,
    userAgent: string,
  ): Promise<string> {
    // Hash du device ID
    const hashedDeviceId = this.hashDeviceId(userAgent, deviceId);

    // Invalider la session précédente du même device
    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        deviceId: hashedDeviceId,
      },
    });

    // Créer le JWT
    const payload = { sub: userId, deviceId: hashedDeviceId };
    const expiresIn = '7d';
    const token = this.jwtService.sign(payload, {
      expiresIn,
    });

    // Décoder le JWT pour obtenir l'expiration
    const decoded = this.jwtService.decode(token) as any;

    // Créer la session en base
    await this.prisma.userSession.create({
      data: {
        userId,
        deviceId: hashedDeviceId,
        token,
        expiresAt: new Date(decoded.exp * 1000),
      },
    });

    return token;
  }

  /**
   * Vérifier si une session est toujours valide
   */
  async validateSession(userId: string, token: string): Promise<boolean> {
    const session = await this.prisma.userSession.findUnique({
      where: { token },
    });

    if (!session) return false;
    if (session.userId !== userId) return false;
    if (session.expiresAt < new Date()) return false;

    return true;
  }

  /**
   * Terminer une session (logout)
   */
  async terminateSession(token: string): Promise<void> {
    await this.prisma.userSession.delete({
      where: { token },
    });
  }

  /**
   * Terminer toutes les sessions d'un utilisateur
   */
  async terminateAllSessions(userId: string): Promise<void> {
    await this.prisma.userSession.deleteMany({
      where: { userId },
    });
  }

  /**
   * Hash le device ID pour éviter de stocker l'User-Agent complet
   */
  private hashDeviceId(userAgent: string, ipAddress: string): string {
    return crypto
      .createHash('sha256')
      .update(`${userAgent}-${ipAddress}`)
      .digest('hex');
  }
}
