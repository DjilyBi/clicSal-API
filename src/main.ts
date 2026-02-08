import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  // Configuration globale
  app.setGlobalPrefix('api/v1');

  // Validation automatique des DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // CORS
  const corsOrigins = process.env.CORS_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
  ];
  
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  // Swagger Documentation
  const config = new DocumentBuilder()
    .setTitle('ClicSal API')
    .setDescription(
      'API Backend pour la gestion de salles de sport en Afrique de l\'Ouest',
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentification & Magic Links')
    .addTag('users', 'Gestion des utilisateurs')
    .addTag('gyms', 'Gestion des salles')
    .addTag('memberships', 'Abonnements & Passes')
    .addTag('check-ins', 'Contrôle d\'accès QR Code')
    .addTag('payments', 'Paiements Wave/Orange Money')
    .addTag('dashboard', 'Tableaux de bord gérants')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`
  ╔═══════════════════════════════════════════════════════╗
  ║                                                       ║
  ║   🏋️  ClicSal API - Gym Management Platform         ║
  ║                                                       ║
  ║   🚀 Server running on: http://localhost:${port}     ║
  ║   📚 Swagger docs: http://localhost:${port}/api/docs ║
  ║   🌍 Environment: ${process.env.NODE_ENV}            ║
  ║                                                       ║
  ╚═══════════════════════════════════════════════════════╝
  `);
}

bootstrap();
