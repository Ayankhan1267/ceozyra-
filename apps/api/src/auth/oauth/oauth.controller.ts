/**
 * ZYRA - OAuth Controller
 * Handles Google OAuth, GitHub OAuth, and Email OTP flows
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { AuthService, type SendOtpDto, type VerifyOtpDto, type VerifyOtpResponse, type OAuthUserRecord } from '../auth.service';

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    tenantId: string | null;
  };
}

@Controller('auth')
export class OAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
  ) {}

  // -- Google OAuth --

  @Get('google')
  @UseGuards(PassportAuthGuard('google'))
  async googleAuth() {
    // Initiates passport-google-oauth20 flow — redirect handled by passport
  }

  @Get('google/callback')
  @UseGuards(PassportAuthGuard('google'))
  async googleCallback(@Request() req: any): Promise<TokenResponse> {
    const user = req.user as OAuthUserRecord;
    return this.buildTokens(user);
  }

  // -- GitHub OAuth --

  @Get('github')
  @UseGuards(PassportAuthGuard('github'))
  async githubAuth() {
    // Initiates passport-github2 flow — redirect handled by passport
  }

  @Get('github/callback')
  @UseGuards(PassportAuthGuard('github'))
  async githubCallback(@Request() req: any): Promise<TokenResponse> {
    const user = req.user as OAuthUserRecord;
    return this.buildTokens(user);
  }

  // -- Email OTP --

  @Post('email/otp')
  @HttpCode(HttpStatus.OK)
  async sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendEmailOtp(dto);
  }

  @Post('email/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    return this.authService.verifyEmailOtp(dto);
  }

  private buildTokens(user: OAuthUserRecord): TokenResponse {
    const jwtSecret = process.env.JWT_SECRET || 'dev-secret-key';
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret';

    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? '' };

    const accessToken = this.jwtService.sign(payload, { secret: jwtSecret, expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, type: 'refresh' },
      { secret: jwtRefreshSecret, expiresIn: '7d' },
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        role: user.role,
        tenantId: user.tenantId,
      },
    };
  }
}
