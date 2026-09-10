/**
 * ZYRA — Auth Module
 * JWT + OAuth (Google + GitHub) + Email OTP authentication
 */

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { RolesGuard } from './roles.guard';
import { OAuthController } from './oauth/oauth.controller';
import { JwtStrategy } from './jwt.strategy';
import { RefreshJwtStrategy } from './refresh-jwt.strategy';
import { OtpService } from './otp.service';

// OAuth strategies
import { GoogleStrategy } from './oauth/google.strategy';
import { GitHubStrategy } from './oauth/github.strategy';

import { DatabaseModule } from '../database/database.module';
import { EventModule } from '../event/event.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EventModule,
    RedisModule,
    PassportModule,
    JwtModule.register({}),
  ],
  providers: [
    AuthService,
    AuthGuard,
    RefreshTokenGuard,
    RolesGuard,
    JwtStrategy,
    RefreshJwtStrategy,
    OtpService,
    {
      provide: GoogleStrategy,
      useFactory: (config: ConfigService, authService: AuthService) => {
        const id = config.get<string>('GOOGLE_CLIENT_ID', '');
        const secret = config.get<string>('GOOGLE_CLIENT_SECRET', '');
        return id && secret ? new GoogleStrategy(config, authService) : null;
      },
      inject: [ConfigService, AuthService],
    },
    {
      provide: GitHubStrategy,
      useFactory: (config: ConfigService, authService: AuthService) => {
        const id = config.get<string>('GITHUB_CLIENT_ID', '');
        const secret = config.get<string>('GITHUB_CLIENT_SECRET', '');
        return id && secret ? new GitHubStrategy(config, authService) : null;
      },
      inject: [ConfigService, AuthService],
    },
  ],
  controllers: [
    OAuthController,
    AuthController,
  ],
  exports: [AuthService, AuthGuard, RefreshTokenGuard, RolesGuard],
})
export class AuthModule {}
