import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';
import { nanoid } from 'nanoid';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  // Générer et envoyer Magic Link
  async sendMagicLink(phone: string) {
    const token = nanoid(32);
    const expiresAt = new Date(
      Date.now() +
        parseInt(process.env.MAGIC_LINK_EXPIRY_MINUTES || '10', 10) * 60 * 1000,
    );

    // Créer le Magic Link
    await this.prisma.magicLink.create({
      data: {
        token,
        phone,
        expiresAt,
      },
    });

    // TODO: Envoyer via WhatsApp (Twilio)
    const magicLinkUrl = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;

    return {
      message: 'Magic link envoyé',
      magicLinkUrl, // À retirer en prod (juste pour dev)
    };
  }

  // Vérifier Magic Link et authentifier
  async verifyMagicLink(
    token: string,
    deviceId: string = 'web-default',
    userAgent: string = 'unknown',
  ) {
    const magicLink = await this.prisma.magicLink.findUnique({
      where: { token },
    });

    if (!magicLink || magicLink.used || magicLink.expiresAt < new Date()) {
      throw new UnauthorizedException('Magic link invalide ou expiré');
    }

    // Marquer comme utilisé
    await this.prisma.magicLink.update({
      where: { id: magicLink.id },
      data: { used: true, usedAt: new Date() },
    });

    // Trouver ou créer l'utilisateur
    let user = await this.prisma.user.findUnique({
      where: { phone: magicLink.phone },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          phone: magicLink.phone,
          isVerified: true,
        },
      });
    }

    // Créer une session (invalide les anciens devices)
    const accessToken = await this.sessionService.createSession(
      user.id,
      deviceId,
      userAgent,
    );

    return {
      accessToken,
      user,
    };
  }
}
