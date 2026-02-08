import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('magic-link/send')
  @ApiOperation({ summary: 'Envoyer un Magic Link par WhatsApp' })
  async sendMagicLink(@Body('phone') phone: string) {
    return this.authService.sendMagicLink(phone);
  }

  @Get('verify')
  @ApiOperation({ summary: 'Vérifier Magic Link et authentifier' })
  async verifyMagicLink(@Query('token') token: string) {
    return this.authService.verifyMagicLink(token);
  }
}
