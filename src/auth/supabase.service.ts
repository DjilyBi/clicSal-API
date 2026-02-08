import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private supabase: SupabaseClient;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase URL or Service Role Key not configured');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.supabase;
  }

  // Vérifier un token JWT Supabase
  async verifyToken(token: string) {
    const { data, error } = await this.supabase.auth.getUser(token);

    if (error) {
      throw new Error(`Token verification failed: ${error.message}`);
    }

    return data.user;
  }

  // Récupérer un utilisateur par ID Supabase
  async getUserById(supabaseId: string) {
    const { data, error } = await this.supabase.auth.admin.getUserById(supabaseId);

    if (error) {
      throw new Error(`User not found: ${error.message}`);
    }

    return data.user;
  }

  // Envoyer un Magic Link via Supabase
  async sendMagicLink(email: string, redirectTo?: string) {
    const { data, error } = await this.supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo || process.env.FRONTEND_URL,
      },
    });

    if (error) {
      throw new Error(`Failed to send magic link: ${error.message}`);
    }

    return data;
  }

  // Envoyer OTP par téléphone via Supabase
  async sendPhoneOTP(phone: string) {
    const { data, error } = await this.supabase.auth.signInWithOtp({
      phone,
    });

    if (error) {
      throw new Error(`Failed to send phone OTP: ${error.message}`);
    }

    return data;
  }

  // Vérifier un OTP téléphone
  async verifyPhoneOTP(phone: string, token: string) {
    const { data, error } = await this.supabase.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      throw new Error(`OTP verification failed: ${error.message}`);
    }

    return data;
  }
}
