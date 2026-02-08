import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AccessCodesService } from './access-codes.service';
import { AccessCodesController } from './access-codes.controller';

@Module({
  providers: [AccessCodesService, PrismaService],
  controllers: [AccessCodesController],
  exports: [AccessCodesService],
})
export class AccessCodesModule {}
