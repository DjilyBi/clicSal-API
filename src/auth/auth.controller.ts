import { Controller, Post, Get, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('magic-link/send')
  @ApiOperation({ summary: 'Envoyer un Magic Link par email via Supabase' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  async sendMagicLink(@Body('email') email: string) {
    return this.authService.sendMagicLink(email);
  }

  @Post('phone/send-otp')
  @ApiOperation({ summary: 'Envoyer un OTP par SMS via Supabase' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '+221771234567' },
      },
    },
  })
  async sendPhoneOTP(@Body('phone') phone: string) {
    return this.authService.sendPhoneOTP(phone);
  }

  @Post('phone/verify-otp')
  @ApiOperation({ summary: 'Vérifier OTP téléphone et créer session' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        phone: { type: 'string', example: '+221771234567' },
        token: { type: 'string', example: '123456' },
        deviceId: { type: 'string', example: 'device-hash-123' },
      },
    },
  })
  async verifyPhoneOTP(
    @Body('phone') phone: string,
    @Body('token') token: string,
    @Body('deviceId') deviceId?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.verifyPhoneOTP(phone, token, deviceId, userAgent);
  }

  @Post('supabase/verify')
  @ApiOperation({
    summary: 'Vérifier token Supabase (après OAuth callback) et créer session',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        supabaseAccessToken: { type: 'string' },
        deviceId: { type: 'string' },
      },
    },
  })
  async verifySupabaseToken(
    @Body('supabaseAccessToken') supabaseAccessToken: string,
    @Body('deviceId') deviceId?: string,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.authService.verifySupabaseToken(supabaseAccessToken, deviceId, userAgent);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Déconnexion - Invalider la session' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        userId: { type: 'string' },
        deviceId: { type: 'string' },
      },
    },
  })
  async logout(@Body('userId') userId: string, @Body('deviceId') deviceId: string) {
    return this.authService.logout(userId, deviceId);
  }
}
