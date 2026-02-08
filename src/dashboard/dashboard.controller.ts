import {
  Controller,
  Get,
  UseGuards,
  Req,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt.guard';
import { DashboardService } from './dashboard.service';
import {
  GetMembersDto,
  GetPaymentsDto,
  DashboardStatsDto,
  MemberResponseDto,
  PaymentResponseDto,
} from './dto/dashboard.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  /**
   * Récupérer la liste de tous les membres avec filtres
   * Filtres: active | expired | expiring_soon | all
   */
  @Get('members')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Liste des membres avec filtres',
    description: `
      Récupérer tous les membres de la salle avec options de filtrage:
      - active: Abonnements actifs
      - expired: Abonnements expirés
      - expiring_soon: Expirant dans 7 jours
      - all: Tous les membres
    `,
  })
  async getMembers(
    @Req() req: any,
    @Query() dto: GetMembersDto,
  ): Promise<{ members: MemberResponseDto[]; total: number; page: number }> {
    const gymId = req.user.gymId; // À implémenter selon votre auth
    const result = await this.dashboardService.getMembers(gymId, dto);
    return {
      ...result,
      page: Math.floor((dto.offset || 0) / (dto.limit || 50)) + 1,
    };
  }

  /**
   * Récupérer l'historique des paiements
   */
  @Get('payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Historique des paiements',
    description: `
      Récupérer tous les paiements avec options de filtrage:
      - type: membership | session_pass | product
      - period: today | week | month
      - status: pending | paid | failed
    `,
  })
  async getPayments(
    @Req() req: any,
    @Query() dto: GetPaymentsDto,
  ): Promise<{
    payments: PaymentResponseDto[];
    total: number;
    totalAmount: number;
    page: number;
  }> {
    const gymId = req.user.gymId;
    const result = await this.dashboardService.getPaymentHistory(gymId, dto);
    return {
      ...result,
      page: Math.floor((dto.offset || 0) / (dto.limit || 50)) + 1,
    };
  }

  /**
   * Qui est actuellement en salle (Live Feed)
   */
  @Get('members/current')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Membres actuellement en salle',
    description: 'Récupérer la liste des membres actuellement en salle',
  })
  async getCurrentlyInGym(@Req() req: any): Promise<any[]> {
    const gymId = req.user.gymId;
    return this.dashboardService.getCurrentlyInGym(gymId);
  }

  /**
   * Statistiques générales du dashboard
   */
  @Get('stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Statistiques du dashboard',
    description: `
      Récupérer les statistiques complètes:
      - Total membres (actifs, expirés, expirant bientôt)
      - Revenus totaux et par type/méthode
      - Nombre actuellement en salle
      - Total check-ins du jour
    `,
  })
  async getStats(@Req() req: any): Promise<DashboardStatsDto> {
    const gymId = req.user.gymId;
    return this.dashboardService.getStats(gymId);
  }

  /**
   * Rapport détaillé financier
   */
  @Get('finance/summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Résumé financier',
    description: 'Récupérer les statistiques financi ères complètes',
  })
  async getFinanceSummary(@Req() req: any): Promise<any> {
    const gymId = req.user.gymId;
    const stats = await this.dashboardService.getStats(gymId);

    return {
      date: new Date(),
      totalRevenue: stats.totalRevenue,
      revenueByType: stats.revenueBreakdown.byType,
      revenueByMethod: stats.revenueBreakdown.byMethod,
      membershipRevenue: stats.revenueBreakdown.byType['membership'] || 0,
      sessionRevenue: stats.revenueBreakdown.byType['session_pass'] || 0,
      productRevenue: stats.revenueBreakdown.byType['product'] || 0,
      wavePayments: stats.revenueBreakdown.byMethod['wave'] || 0,
      orangeMoneyPayments:
        stats.revenueBreakdown.byMethod['orange_money'] || 0,
      cashPayments: stats.revenueBreakdown.byMethod['cash'] || 0,
    };
  }
}
