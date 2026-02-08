import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour scanner un QR code à l'entrée
 */
export class ScanQRDto {
  @ApiProperty({
    description: 'Valeur du code QR scannée',
    example: 'acc_5f9b8c2k9m3p1q7r9t2u',
  })
  @IsString()
  @IsNotEmpty()
  codeValue: string;

  @ApiProperty({
    description: 'ID du staff qui a scanné (optionnel)',
    example: 'staff_123abc',
    required: false,
  })
  @IsString()
  @IsOptional()
  staffId?: string;
}

/**
 * DTO pour validation de sortie via QR fixe du gym
 */
export class ExitValidationDto {
  @ApiProperty({
    description: 'QR code fixe de sortie du gym',
    example: 'exit_gym_12345',
  })
  @IsString()
  @IsNotEmpty()
  exitQRCode: string;
}

/**
 * DTO pour réponse check-in
 */
export class CheckInResponseDto {
  message: string;
  checkIn: {
    id: string;
    userId: string;
    gymId: string;
    type: string;
    scannedAt: Date;
  };
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
  };
}

/**
 * DTO pour statut check-in utilisateur
 */
export class UserCheckInStatusDto {
  status: 'not_entered' | 'in_gym' | 'exited';
  message: string;
  timestamp?: Date;
}

/**
 * DTO pour utilisateurs en salle
 */
export class CurrentlyInGymDto {
  count: number;
  users: Array<{
    id: string;
    firstName?: string;
    lastName?: string;
    photoUrl?: string;
    enteredAt: Date;
    lastAction: 'entry' | 'exit';
  }>;
}

/**
 * DTO pour statistiques du jour
 */
export class DailyStatsDto {
  date: Date;
  totalEntries: number;
  totalExits: number;
  currentlyInGym: number;
}
