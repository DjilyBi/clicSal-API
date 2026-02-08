import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from './session.service';
import { SupabaseService } from './supabase.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
    private supabase: SupabaseService,
  ) {}

  /**
   * Envoyer un Magic Link via Supabase
   * Supabase gère l'envoi d'email automatiquement
   */
  async sendMagicLink(email: string) {
    await this.supabase.sendMagicLink(email, `${process.env.FRONTEND_URL}/auth/callback`);

    return {
      message: 'Magic link envoyé à votre email',
      email,
    };
  }

  /**
   * Envoyer un OTP par téléphone via Supabase
   * Supabase gère l'envoi de SMS automatiquement
   */
  async sendPhoneOTP(phone: string) {
    // Format: +221771234567
    await this.supabase.sendPhoneOTP(phone);

    return {
      message: 'Code OTP envoyé par SMS',
      phone,
    };
  }

  /**
   * Vérifier OTP téléphone et créer session
   */
  async verifyPhoneOTP(
    phone: string,
    token: string,
    deviceId: string = 'web-default',
    userAgent: string = 'unknown',
  ) {
    // Vérifier OTP via Supabase
    const { user: supabaseUser, session } = await this.supabase.verifyPhoneOTP(phone, token);

    if (!supabaseUser) {
      throw new UnauthorizedException('OTP invalide ou expiré');
    }

    // Synchroniser ou créer user dans notre DB
    const user = await this.syncUserFromSupabase(supabaseUser);

    // Créer une session avec multi-device lock
    const accessToken = await this.sessionService.createSession(
      user.id,
      deviceId,
      userAgent,
    );

    return {
      accessToken,
      user,
      supabaseSession: session,
    };
  }

  /**
   * Vérifier un token Supabase et créer/synchroniser user
   * Utilisé après callback OAuth (Google, Apple, etc.)
   */
  async verifySupabaseToken(
    supabaseAccessToken: string,
    deviceId: string = 'web-default',
    userAgent: string = 'unknown',
  ) {
    // Vérifier le token avec Supabase
    const supabaseUser = await this.supabase.verifyToken(supabaseAccessToken);

    if (!supabaseUser) {
      throw new UnauthorizedException('Token Supabase invalide');
    }

    // Synchroniser ou créer user dans notre DB
    const user = await this.syncUserFromSupabase(supabaseUser);

    // Créer une session avec multi-device lock
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

  /**
   * Synchroniser un user Supabase avec notre DB
   * Crée le user s'il n'existe pas, sinon met à jour
   */
  private async syncUserFromSupabase(supabaseUser: any) {
    let user = await this.prisma.user.findUnique({
      where: { supabaseId: supabaseUser.id },
    });

    if (!user) {
      // Créer nouveau user
      user = await this.prisma.user.create({
        data: {
          supabaseId: supabaseUser.id,
          email: supabaseUser.email,
          phone: supabaseUser.phone,
          firstName: supabaseUser.user_metadata?.first_name,
          lastName: supabaseUser.user_metadata?.last_name,
          photoUrl: supabaseUser.user_metadata?.avatar_url,
          isVerified: supabaseUser.email_confirmed_at !== null,
          authProvider: 'supabase',
        },
      });
    } else {
      // Mettre à jour les infos si nécessaire
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: supabaseUser.email || user.email,
          phone: supabaseUser.phone || user.phone,
          firstName: supabaseUser.user_metadata?.first_name || user.firstName,
          lastName: supabaseUser.user_metadata?.last_name || user.lastName,
          photoUrl: supabaseUser.user_metadata?.avatar_url || user.photoUrl,
          isVerified: supabaseUser.email_confirmed_at !== null,
        },
      });
    }

    return user;
  }

  /**
   * Logout - Invalider la session
   */
  async logout(userId: string, deviceId: string) {
    await this.prisma.userSession.deleteMany({
      where: {
        userId,
        deviceId,
      },
    });

    return { message: 'Déconnecté avec succès' };
  }
}
