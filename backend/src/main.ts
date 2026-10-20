import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { GlobalHttpExceptionFilter } from './common/http-exception.filter.js';
import { assertProductionEnv } from './security.js';

async function bootstrap() {
  // STEP 22: refuse to boot production with placeholder secrets.
  assertProductionEnv(process.env as Record<string, string>);
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Single reverse-proxy hop (nginx/nginx.conf): trust X-Forwarded-For so
  // per-client rate limits see the real client IP instead of one shared bucket.
  app.set('trust proxy', 1);

  // Per-instance in-memory rate limits + lockout state when REDIS_URL is unset.
  if (process.env.NODE_ENV === 'production' && !process.env.REDIS_URL) {
    Logger.warn(
      'REDIS_URL is unset: using in-memory rate limits and lockout state (per-instance only)',
      'Bootstrap',
    );
  }

  // Security headers on every response (PRD §32).
  app.use(helmet());

  // Input validation at the boundary: strip unknown fields, reject junk (PRD §32).
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  // L1 global filter: HttpExceptions pass through byte-identical; only
  // non-HTTP throwables become structured 500s (logged server-side).
  app.useGlobalFilters(new GlobalHttpExceptionFilter());

  const apiPrefix = process.env.API_PREFIX ?? 'api/v1';
  app.setGlobalPrefix(apiPrefix);

  // Mobile apps are not browsers, so CORS is off by default. Set CORS_ORIGIN
  // only for an optional browser/SIMRS integration (comma-separated origins).
  const corsOrigin = process.env.CORS_ORIGIN?.trim();
  if (corsOrigin) {
    app.enableCors({ origin: corsOrigin.split(',').map((o) => o.trim()) });
  }

  // OpenAPI docs for SIMRS integrators. Explicit DOCS_ENABLED wins; otherwise
  // on everywhere except production (off in production by default).
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
