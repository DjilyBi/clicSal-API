import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GymsModule } from './gyms/gyms.module';
import { AccessCodesModule } from './access-codes/access-codes.module';
import { MembershipsModule } from './memberships/memberships.module';
import { CheckInsModule } from './check-ins/check-ins.module';
import { PaymentsModule } from './payments/payments.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    // Configuration globale
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Cron jobs (QR refresh, etc.)
    ScheduleModule.forRoot(),

    // Rate limiting (sécurité)
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
      },
    ]),

    // Modules métier
    PrismaModule,
    AuthModule,
    UsersModule,
    GymsModule,
    AccessCodesModule,
    MembershipsModule,
    CheckInsModule,
    PaymentsModule,
    DashboardModule,
    WebsocketModule,
  ],
})
export class AppModule {}
