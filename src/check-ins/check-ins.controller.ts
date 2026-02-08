import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
import { CheckInsService } from './check-ins.service';
import {
  ScanQRDto,
  ExitValidationDto,
  CheckInResponseDto,
  UserCheckInStatusDto,
  CurrentlyInGymDto,
  DailyStatsDto,
} from './dto/check-in.dto';

@ApiTags('Check-ins')
@Controller('check-ins')
export class CheckInsController {
  constructor(private checkInsService: CheckInsService) {}

  /**
   * POST /check-ins/scan
   * Staff scanne un QR code pour faire entrer un user
   * Utilise authentication, mais le staff peut scanner pour n'importe quel user
   */
  @Post('scan')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Scanner QR code entrée',
    description:
      'Staff scanne le QR code dynamique pour valider l\'entrée d\'un user au gym',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 201,
    description: 'Entrée validée',
    schema: {
      example: {
        message: 'Accès autorisé ✅',
        user: {
          id: 'user_123',
          firstName: 'Jean',
          lastName: 'Dupont',
          photoUrl: 'https://...',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'QR code expiré ou invalide',
  })
  @ApiResponse({
    status: 409,
    description: 'User déjà en salle ou access refusé',
  })
  async scanEntry(@Body() dto: ScanQRDto, @Req() req: any) {
    const gymId = req.user.gymId; // Staff doit avoir un gymId
    return this.checkInsService.validateEntry(
      gymId,
      dto.codeValue,
      req.user.id,
    );
  }

  /**
   * GET /check-ins/exit?exitQRCode=...
   * User scanne le QR code de sortie fixe du gym
   * Pas d'auth nécessaire (anyone can exit)
   */
  @Get('exit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Valider sortie',
    description:
      'User scanne le QR code fixe de sortie pour se signaler comme sorti',
  })
  @ApiResponse({
    status: 200,
    description: 'Sortie validée',
    schema: {
      example: {
        message: 'Bonne journée ! ✅',
        user: {
          id: 'user_123',
          firstName: 'Jean',
          lastName: 'Dupont',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Aucune entrée active',
  })
  async scanExit(@Req() req: any) {
    const gymId = req.query.gymId; // Passé par query param
    const exitQRCode = req.query.exitQRCode;

    if (!gymId || !exitQRCode) {
      return {
        error: 'Missing gymId or exitQRCode',
      };
    }

    return this.checkInsService.validateExit(gymId, exitQRCode);
  }

  /**
   * GET /check-ins/status/:userId/:gymId
   * Récupérer le statut check-in actuel d'un user dans un gym
   * Utile pour le dashboard staff
   */
  @Get('status/:userId/:gymId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Statut check-in utilisateur',
    description:
      'Récupère le statut d\'un user : pas entré, en salle, ou sorti',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Statut check-in',
    type: UserCheckInStatusDto,
  })
  async getUserStatus(
    @Param('userId') userId: string,
    @Param('gymId') gymId: string,
  ) {
    return this.checkInsService.getUserCheckInStatus(userId, gymId);
  }

  /**
   * GET /check-ins/live/:gymId
   * Récupérer la liste des users actuellement en salle
   * Utile pour le dashboard manager
   */
  @Get('live/:gymId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Users actuellement en salle',
    description:
      'Affiche la liste de tous les users actuellement en salle avec leur heure d\'entrée',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Liste des users en salle',
    type: CurrentlyInGymDto,
  })
  async getLiveData(@Param('gymId') gymId: string) {
    return this.checkInsService.getCurrentlyInGym(gymId);
  }

  /**
   * GET /check-ins/stats/:gymId
   * Statistiques check-in du jour (entries, exits, currently in)
   * Utile pour le dashboard et les graphiques
   */
  @Get('stats/:gymId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Statistiques check-in du jour',
    description:
      'Nombre entries, exits, et users actuellement en salle pour le jour',
  })
  @ApiBearerAuth()
  @ApiResponse({
    status: 200,
    description: 'Stats du jour',
    type: DailyStatsDto,
  })
  async getDailyStats(@Param('gymId') gymId: string) {
    return this.checkInsService.getDailyStats(gymId);
  }
}
