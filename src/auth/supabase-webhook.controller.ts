import { Controller, Post, Body, Headers, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Webhook Controller pour synchroniser les événements Supabase Auth
 * 
 * Configuration Supabase:
 * 1. Aller dans Dashboard > Database > Webhooks
 * 2. Create a new hook
 * 3. Events: INSERT on auth.users, UPDATE on auth.users
 * 4. Webhook URL: https://your-api.com/webhooks/supabase/auth
 * 5. HTTP Headers: x-supabase-signature: [généré automatiquement]
 */

@ApiTags('webhooks')
@Controller('webhooks/supabase')
export class SupabaseWebhookController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Post('auth')
  @ApiOperation({ summary: 'Webhook Supabase Auth - Sync users automatique' })
  @ApiExcludeEndpoint() // Ne pas exposer dans Swagger public
  async handleAuthEvent(
    @Body() payload: any,
    @Headers('x-supabase-signature') signature: string,
  ) {
    // Vérifier la signature du webhook (sécurité)
    this.verifyWebhookSignature(payload, signature);

    const { type, table, record, old_record } = payload;

    // On ne traite que les événements de la table auth.users
    if (table !== 'users') {
      return { received: true, processed: false };
    }

    try {
      switch (type) {
        case 'INSERT':
          await this.handleUserCreated(record);
          break;
        case 'UPDATE':
          await this.handleUserUpdated(record, old_record);
          break;
        case 'DELETE':
          await this.handleUserDeleted(old_record);
          break;
      }

      return { received: true, processed: true };
    } catch (error) {
      console.error('Webhook processing error:', error);
      return { received: true, processed: false, error: error.message };
    }
  }

  private verifyWebhookSignature(payload: any, signature: string) {
    const webhookSecret = this.config.get<string>('SUPABASE_WEBHOOK_SECRET');

    if (!webhookSecret) {
      console.warn('SUPABASE_WEBHOOK_SECRET not configured - skipping verification');
      return;
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(payloadString)
      .digest('hex');

    if (signature !== expectedSignature) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  private async handleUserCreated(supabaseUser: any) {
    // Créer user dans notre DB
    const user = await this.prisma.user.create({
      data: {
        supabaseId: supabaseUser.id,
        email: supabaseUser.email,
        phone: supabaseUser.phone,
        firstName: supabaseUser.raw_user_meta_data?.first_name,
        lastName: supabaseUser.raw_user_meta_data?.last_name,
        photoUrl: supabaseUser.raw_user_meta_data?.avatar_url,
        isVerified: supabaseUser.email_confirmed_at !== null,
        authProvider: 'supabase',
      },
    });

    console.log(`✅ User synced from Supabase: ${user.id}`);
    return user;
  }

  private async handleUserUpdated(supabaseUser: any, oldRecord: any) {
    // Mettre à jour user dans notre DB
    const user = await this.prisma.user.update({
      where: { supabaseId: supabaseUser.id },
      data: {
        email: supabaseUser.email,
        phone: supabaseUser.phone,
        firstName: supabaseUser.raw_user_meta_data?.first_name,
        lastName: supabaseUser.raw_user_meta_data?.last_name,
        photoUrl: supabaseUser.raw_user_meta_data?.avatar_url,
        isVerified: supabaseUser.email_confirmed_at !== null,
      },
    });

    console.log(`✅ User updated from Supabase: ${user.id}`);
    return user;
  }

  private async handleUserDeleted(supabaseUser: any) {
    // Soft delete ou hard delete selon la stratégie
    await this.prisma.user.delete({
      where: { supabaseId: supabaseUser.id },
    });

    console.log(`✅ User deleted from Supabase: ${supabaseUser.id}`);
  }
}
