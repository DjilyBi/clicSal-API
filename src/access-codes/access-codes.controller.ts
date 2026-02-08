import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { AccessCodesService } from './access-codes.service';

@ApiTags('Access Codes')
@Controller('access-codes')
export class AccessCodesController {
  constructor(private accessCodesService: AccessCodesService) {}

  /**
   * GET /access-codes/display
   * Récupérer le QR code courant pour affichage
   * Utilisé par l'app mobile
   */
  @Get('display')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Récupérer le QR code à afficher',
    description:
      'Retourne le code_value courant et la date d\'expiration pour affichage dans l\'app mobile',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'QR code courant',
    schema: {
      example: {
        codeValue: 'acc_5f9b8c2k9m3p1q7r9t2u',
        expiresAt: '2024-01-15T11:30:00Z',
        refreshUrl: '/access-codes/refresh?shareToken=token_abcdef123...',
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Aucun code valide trouvé',
  })
  async getDisplayCode(@Req() req: any) {
    return this.accessCodesService.getDisplayCode(req.user.id);
  }

  /**
   * POST /access-codes/refresh
   * Rafraîchir manuellement le QR code
   * (Auto-refresh aussi disponible via cron)
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rafraîchir le QR code',
    description:
      'Génère un nouveau code_value et étend l\'expiration à 1h. Peut être appelé manuellement par l\'app.',
  })
  @ApiResponse({
    status: 200,
    description: 'QR code rafraîchi',
    schema: {
      example: {
        message: 'QR code rafraîchi ✅',
        codeValue: 'acc_newcode123xyz',
        expiresAt: '2024-01-15T12:30:00Z',
      },
    },
  })
  async refreshCode(@Query('shareToken') shareToken: string) {
    if (!shareToken) {
      return { error: 'shareToken query parameter required' };
    }

    return this.accessCodesService.refreshAccessCode(shareToken);
  }

  /**
   * GET /access-codes/:userId
   * Récupérer tous les codes actifs d'un user
   * Admin/staff seulement
   */
  @Get(':userId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Codes actifs d\'un user',
    description:
      'Récupère tous les access codes en cours de validité pour un user. Requiert auth.',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Liste des codes actifs',
  })
  async getUserCodes(@Param('userId') userId: string) {
    return this.accessCodesService.getUserAccessCodes(userId);
  }

  /**
   * DELETE /access-codes/:codeId
   * Révoquer un access code
   * (Utilisé si code compromis)
   */
  @Delete(':codeId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Révoquer un access code',
    description:
      'Supprime un access code spécifique. Utilisé si code est compromis ou obsolète.',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 204,
    description: 'Code révoqué',
  })
  async revokeCode(@Param('codeId') codeId: string) {
    return this.accessCodesService.revokeAccessCode(codeId);
  }
}
