import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter.js';
import { assertProductionEnv } from './security.js';

async function bootstrap() {
  assertProductionEnv(process.env as Record<string, string>);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.set('trust proxy', 1);

  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    Logger.warn(
      'REDIS_URL is unset: using in-memory rate limits and lockout state (per-instance only)',
      'Bootstrap',
    );
  }

  app.use(helmet());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()) });
  }

  const docsEnabled =
    process.env.DOCS_ENABLED !== undefined
      ? process.env.DOCS_ENABLED === 'true'
      : process.env.NODE_ENV !== 'production';
  if (docsEnabled) {
    const docsConfig = new DocumentBuilder()
      .setTitle('Face Absen API')
      .setDescription('Hospital attendance API for SIMRS integration')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, docsConfig);
    SwaggerModule.setup('docs', app, document);
    Logger.log('OpenAPI docs available at /docs', 'Bootstrap');
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
}
await bootstrap();
