import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CheckInsService } from './check-ins.service';
import { CheckInsController } from './check-ins.controller';

@Module({
  providers: [CheckInsService, PrismaService],
  controllers: [CheckInsController],
  exports: [CheckInsService],
})
export class CheckInsModule {}
