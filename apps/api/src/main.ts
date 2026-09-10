import 'reflect-metadata';
import * as path from 'path';
import { config as dotenv } from 'dotenv';
import { NestFactory, HttpAdapterHost } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { config, assertEnvValid } from '@zyra/config';

// ---------------------------------------------------------------------------
// Load environment files (order matters — last file wins with override)
// ---------------------------------------------------------------------------
const envRoot = path.resolve(__dirname, '../../../');
dotenv({ path: path.join(envRoot, '.env') });
const appEnv = process.env.APP_ENV || process.env.NODE_ENV;
if (appEnv === 'production') {
  dotenv({ path: path.join(envRoot, '.env.production'), override: true });
} else if (appEnv === 'qa') {
  dotenv({ path: path.join(envRoot, '.env.qa'), override: true });
}

// Validate environment variables before the app boots — exits process if critical vars missing
assertEnvValid();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const env = process.env.NODE_ENV || 'development';

  // CORS — allowlisted origins per environment
  app.enableCors({
    origin: env === 'production'
      ? ['https://ceozyra.com', 'https://www.ceozyra.com', 'https://app.ceozyra.com', 'https://admin.ceozyra.com']
      : env === 'qa'
        ? ['https://qa.ceozyra.com']
        : true,
    credentials: true,
  });

  // Request-scoped validation
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Global logging interceptor — logs every HTTP request
  // Imported lazily to avoid circular dependency at module init time
  const { LoggingInterceptor } = await import('./common/interceptors/logging.interceptor');
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Global exception filter — consistent error response envelope
  const { HttpExceptionFilter } = await import('./common/filters/http-exception.filter');
  const httpAdapterHost = app.get(HttpAdapterHost);
  app.useGlobalFilters(new HttpExceptionFilter(httpAdapterHost));

  const port = parseInt(process.env.PORT || process.env.API_PORT || '4000', 10);
  await app.listen(port);

  console.log(`\n🚀 ZYRA API running on port ${port}`);
  console.log(`📋 Environment: ${env}`);
  console.log(`🔗 API URL: ${env === 'production' ? 'https://api.ceozyra.com' : `http://localhost:${port}`}`);
}

bootstrap().catch((err) => {
  console.error('Failed to start ZYRA API:', err);
  process.exit(1);
});
