/**
 * ZYRA — Config Package
 * Environment configuration management
 */

export type Environment = 'development' | 'qa' | 'production';

export interface ZyraConfig {
  env: Environment;
  nodeEnv: string;
  database: {
    url: string;
    urlQA: string;
    urlProd: string;
  };
  redis: {
    url: string;
    password: string;
  };
  jwt: {
    secret: string;
    refreshSecret: string;
    expiry: string;
    refreshExpiry: string;
  };
  api: {
    port: number;
    url: string;
  };
  web: {
    appUrl: string;
    adminUrl: string;
  };
  ai: {
    serviceUrl: string;
    apiKey: string;
  };
  storage: {
    endpoint: string;
    bucket: string;
    accessKey: string;
    secretKey: string;
    region: string;
  };
  email: {
    smtpHost: string;
    smtpPort: string;
    smtpUser: string;
    smtpPass: string;
    from: string;
  };
  whatsapp: {
    apiUrl: string;
    apiToken: string;
    phoneNumberId: string;
  };
  sms: {
    provider: string;
    apiKey: string;
    senderId: string;
  };
  payments: {
    razorpayKeyId: string;
    razorpayKeySecret: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
  };
  oauth: {
    googleClientId: string;
    googleClientSecret: string;
  };
  meta: {
    appId: string;
    appSecret: string;
    accessToken: string;
  };
  observability: {
    sentryDsn: string;
    otelEndpoint: string;
    logLevel: string;
  };
}

function getEnv(key: string, fallback: string = ''): string {
  const value = process.env[key];
  return value !== undefined ? value : fallback;
}

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getConfig(): ZyraConfig {
  const env = (getEnv('APP_ENV', 'development') as Environment);
  const nodeEnv = getEnv('NODE_ENV', 'development');

  return {
    env,
    nodeEnv,
    database: {
      url: getEnv('DATABASE_URL'),
      urlQA: getEnv('DATABASE_URL_QA'),
      urlProd: getEnv('DATABASE_URL_PROD'),
    },
    redis: {
      url: getEnv('REDIS_URL', 'redis://localhost:6379'),
      password: getEnv('REDIS_PASSWORD'),
    },
    jwt: {
      secret: getEnvOrThrow('JWT_SECRET'),
      refreshSecret: getEnvOrThrow('JWT_REFRESH_SECRET'),
      expiry: getEnv('JWT_EXPIRY', '15m'),
      refreshExpiry: getEnv('JWT_REFRESH_EXPIRY', '7d'),
    },
    api: {
      port: parseInt(getEnv('API_PORT', '4000'), 10),
      url: getEnv('API_URL', 'http://localhost:4000'),
    },
    web: {
      appUrl: getEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3000'),
      adminUrl: getEnv('NEXT_PUBLIC_ADMIN_URL', 'http://localhost:3003'),
    },
    ai: {
      serviceUrl: getEnv('AI_SERVICE_URL', 'http://localhost:8000'),
      apiKey: getEnv('AI_API_KEY'),
    },
    storage: {
      endpoint: getEnv('S3_ENDPOINT'),
      bucket: getEnv('S3_BUCKET', 'zyra-uploads'),
      accessKey: getEnv('S3_ACCESS_KEY'),
      secretKey: getEnv('S3_SECRET_KEY'),
      region: getEnv('S3_REGION', 'us-east-1'),
    },
    email: {
      smtpHost: getEnv('SMTP_HOST'),
      smtpPort: getEnv('SMTP_PORT'),
      smtpUser: getEnv('SMTP_USER'),
      smtpPass: getEnv('SMTP_PASS'),
      from: getEnv('EMAIL_FROM', 'noreply@ceozyra.com'),
    },
    whatsapp: {
      apiUrl: getEnv('WHATSAPP_API_URL'),
      apiToken: getEnv('WHATSAPP_API_TOKEN'),
      phoneNumberId: getEnv('WHATSAPP_PHONE_NUMBER_ID'),
    },
    sms: {
      provider: getEnv('SMS_PROVIDER'),
      apiKey: getEnv('SMS_API_KEY'),
      senderId: getEnv('SMS_SENDER_ID'),
    },
    payments: {
      razorpayKeyId: getEnv('RAZORPAY_KEY_ID'),
      razorpayKeySecret: getEnv('RAZORPAY_KEY_SECRET'),
      stripeSecretKey: getEnv('STRIPE_SECRET_KEY'),
      stripeWebhookSecret: getEnv('STRIPE_WEBHOOK_SECRET'),
    },
    oauth: {
      googleClientId: getEnv('GOOGLE_CLIENT_ID'),
      googleClientSecret: getEnv('GOOGLE_CLIENT_SECRET'),
    },
    meta: {
      appId: getEnv('META_APP_ID'),
      appSecret: getEnv('META_APP_SECRET'),
      accessToken: getEnv('META_ACCESS_TOKEN'),
    },
    observability: {
      sentryDsn: getEnv('SENTRY_DSN'),
      otelEndpoint: getEnv('OTEL_EXPORTER_OTLP_ENDPOINT'),
      logLevel: getEnv('LOG_LEVEL', 'info'),
    },
  };
}

export { validateEnv, assertEnvValid, type ValidationResult } from './env.validation.js';

let cachedConfig: ZyraConfig | null = null;

export function config(): ZyraConfig {
  if (!cachedConfig) {
    cachedConfig = getConfig();
  }
  return cachedConfig;
}

export function isProduction(): boolean {
  return getConfig().env === 'production';
}

export function isQA(): boolean {
  return getConfig().env === 'qa';
}

export function isDevelopment(): boolean {
  return getConfig().env === 'development';
}

export { ZyraLogger, createLogger, setRequestId, clearRequestId, type LogLevel, type LogContext } from './logger.js';
