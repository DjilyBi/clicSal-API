import { IsOptional, IsEnum, IsUUID } from 'class-validator';
import { MembershipStatus, PaymentType } from '@prisma/client';
import { Type } from 'class-transformer';

export class GetMembersDto {
  @IsOptional()
  @IsEnum(MembershipStatus)
  filter?: 'all' | 'active' | 'expired' | 'expiring_soon';

  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;

  @IsOptional()
  search?: string; // Recherche par nom/phone
}

export class GetPaymentsDto {
  @IsOptional()
  @IsEnum(['membership', 'session_pass', 'product'])
  type?: PaymentType;

  @IsOptional()
  @IsEnum(['today', 'week', 'month'])
  period?: 'today' | 'week' | 'month' = 'today';

  @IsOptional()
  @IsEnum(['pending', 'paid', 'failed'])
  status?: 'pending' | 'paid' | 'failed';

  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  offset?: number = 0;
}

export class MemberResponseDto {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  photoUrl: string | null;

  membership?: {
    id: string;
    type: string;
    status: string;
    startDate: Date;
    endDate: Date;
    daysUntilExpiry?: number;
  };

  lastCheckIn?: {
    scannedAt: Date;
    type: string;
  };

  totalSpent?: number;
}

export class PaymentResponseDto {
  id: string;
  user?: {
    id: string;
    firstName: string;
    phone: string;
  };
  paymentType: string;
  amount: number;
  method: string;
  status: string;
  createdAt: Date;
  reference?: {
    type: string;
    details: string;
  };
}

export class DashboardStatsDto {
  totalMembers: number;
  activeMembers: number;
  expiredMembers: number;
  expiringNext7Days: number;
  totalRevenue: number;
  revenueBreakdown: {
    byType: Record<string, number>;
    byMethod: Record<string, number>;
  };
  currentlyInGym: number;
  totalCheckinsToday: number;
}
