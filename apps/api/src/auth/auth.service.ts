/**
 * ZYRA - Auth Service
 * JWT-based authentication with bcrypt password hashing + OAuth support
 */

import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { EventBusService } from '../event/event.service';
import { OtpService } from './otp.service';

export interface RegisterDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
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

export interface OAuthUserInput {
  email: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  provider: string;
  externalId: string;
  accessToken: string;
  refreshToken: string;
}

export interface SendOtpDto {
  email: string;
}

export interface VerifyOtpDto {
  email: string;
  code: string;
}

export interface VerifyOtpResponse extends AuthResponse {
  isNewUser: boolean;
}

/** Returned by findOrCreateOAuthUser — flat user fields, no tenant relation */
export interface OAuthUserRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  tenantId: string | null;
  emailVerified: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly eventBus: EventBusService,
    private readonly otpService: OtpService,
  ) {}

  // ─── Registration & Login ───────────────────────────────────────

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const existing = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const existingSlug = await this.prisma.tenant.findUnique({ where: { slug: dto.tenantSlug } });
    if (existingSlug) throw new ConflictException('Organization slug already taken');

    const hashedPassword = await bcrypt.hash(dto.password, 12);

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug, status: 'TRIAL', plan: 'STARTER' },
      });
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          role: 'OWNER',
          tenantId: tenant.id,
          emailVerified: true,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true },
      });
      await tx.storefront.create({
        data: { name: dto.tenantName, slug: dto.tenantSlug, tenantId: tenant.id },
      });
      return { user, tenant };
    });

    this.eventBus.emit('user.created', { userId: result.user.id, tenantId: result.tenant.id });
    this.eventBus.emit('tenant.created', { tenantId: result.tenant.id });

    return this.generateTokens(result.user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findFirst({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    return this.generateTokens(user);
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, tenantId: true, emailVerified: true,
        tenant: { select: { name: true, slug: true, status: true } },
      },
    });
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, tenantId: true, emailVerified: true, createdAt: true,
        tenant: { select: { name: true, slug: true, status: true, plan: true } },
      },
    });
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    // OAuth users have no password field set
    if (!user.password) {
      throw new UnauthorizedException('Cannot change password for OAuth-authenticated accounts');
    }

    const valid = await bcrypt.compare(oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('Incorrect current password');

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    return { message: 'Password changed successfully' };
  }

  // ─── Token Generation ───────────────────────────────────────────

  generateTokens(user: { id: string; email: string; role: string; tenantId: string | null; firstName?: string | null; lastName?: string | null }): AuthResponse {
    const jwtSecret = this.configService.get<string>('JWT_SECRET', 'dev-secret-key');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET', 'dev-refresh-secret');

    const payload = { sub: user.id, email: user.email, role: user.role, tenantId: user.tenantId ?? '' };

    const accessToken = this.jwtService.sign(payload, { secret: jwtSecret, expiresIn: '15m' });
    const refreshToken = this.jwtService.sign({ sub: user.id, type: 'refresh' }, { secret: jwtRefreshSecret, expiresIn: '7d' });

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

  // ─── OAuth: Unified Identity ────────────────────────────────────

  /**
   * Find or create a user from OAuth provider data.
   * Returns a flat user record (no tenant relation). Caller is responsible for token generation.
   */
  async findOrCreateOAuthUser(input: OAuthUserInput): Promise<OAuthUserRecord> {
    const existing = await this.prisma.user.findFirst({
      where: { email: input.email },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, emailVerified: true, password: true, avatar: true },
    });

    if (existing) {
      const updated = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          avatar: input.avatar ?? existing.avatar,
          provider: input.provider,
          emailVerified: true,
          isActive: true,
          lastLoginAt: new Date(),
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, emailVerified: true },
      });
      return updated;
    }

    // New user — create a tenant and assign as OWNER
    const baseSlug = input.email.split('@')[0].replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 20);
    let tenantSlug = baseSlug || `user-${input.externalId.slice(0, 8)}`;
    let counter = 1;
    let finalSlug = tenantSlug;

    while (await this.prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
      finalSlug = `${tenantSlug}-${counter++}`;
    }

    const tenantName = `${input.firstName} ${input.lastName}`.trim() || input.email;

    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: tenantName, slug: finalSlug, status: 'TRIAL', plan: 'STARTER' },
      });

      const user = await tx.user.create({
        data: {
          email: input.email,
          password: '', // OAuth users have no password
          firstName: input.firstName,
          lastName: input.lastName,
          avatar: input.avatar,
          role: 'OWNER',
          tenantId: tenant.id,
          emailVerified: true,
          provider: input.provider,
        },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, emailVerified: true },
      });

      await tx.storefront.create({
        data: { name: tenantName, slug: finalSlug, tenantId: tenant.id },
      });

      return { user, tenant };
    });

    this.eventBus.emit('user.created', { userId: result.user.id, tenantId: result.tenant.id });
    this.eventBus.emit('tenant.created', { tenantId: result.tenant.id });

    return result.user;
  }

  // ─── Email OTP ──────────────────────────────────────────────────

  async sendEmailOtp(dto: SendOtpDto) {
    const rateLimit = await this.prisma.rateLimit.findUnique({
      where: { key: `otp:send:${dto.email}` },
    });

    if (rateLimit && rateLimit.points >= 5 && rateLimit.expiresAt > new Date()) {
      throw new ConflictException('Too many OTP requests. Please wait before retrying.');
    }

    const code = this.otpService.generateOTP();
    await this.otpService.storeOTP(dto.email, code, 300);

    await this.prisma.rateLimit.upsert({
      where: { key: `otp:send:${dto.email}` },
      update: { points: { increment: 1 }, expiresAt: new Date(Date.now() + 3600_000) },
      create: { key: `otp:send:${dto.email}`, points: 1, expiresAt: new Date(Date.now() + 3600_000) },
    });

    const env = this.configService.get<string>('NODE_ENV', 'development');
    if (env === 'development') {
      console.log(`[OTP] Code for ${dto.email}: ${code}`);
    }

    this.eventBus.emit('otp.requested', {
      email: dto.email,
      code,
      expiresAt: new Date(Date.now() + 300_000),
    });

    return { message: 'OTP sent to email', expiresIn: 300 };
  }

  async verifyEmailOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponse> {
    const isValid = await this.otpService.verifyOTP(dto.email, dto.code);
    if (!isValid) throw new UnauthorizedException('Invalid or expired OTP code');

    // Account linking: same email = same account (unified identity)
    const existing = await this.prisma.user.findFirst({
      where: { email: dto.email },
      select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, emailVerified: true, password: true, avatar: true },
    });

    let user: OAuthUserRecord;
    let isNewUser = false;

    if (existing) {
      // Existing user — mark email verified and log them in
      user = await this.prisma.user.update({
        where: { id: existing.id },
        data: { emailVerified: true, isActive: true, lastLoginAt: new Date() },
        select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, emailVerified: true },
      });
    } else {
      // New user — create a tenant and assign as OWNER
      const baseSlug = dto.email.split('@')[0].replace(/[^a-z0-9-]/gi, '').toLowerCase().slice(0, 20);
      let tenantSlug = baseSlug || `user-${dto.email.slice(0, 8)}`;
      let counter = 1;
      let finalSlug = tenantSlug;

      while (await this.prisma.tenant.findUnique({ where: { slug: finalSlug } })) {
        finalSlug = `${tenantSlug}-${counter++}`;
      }

      const result = await this.prisma.$transaction(async (tx) => {
        const tenant = await tx.tenant.create({
          data: { name: dto.email, slug: finalSlug, status: 'TRIAL', plan: 'STARTER' },
        });
        const newUser = await tx.user.create({
          data: {
            email: dto.email,
            password: '',
            role: 'OWNER',
            tenantId: tenant.id,
            emailVerified: true,
            provider: 'email',
          },
          select: { id: true, email: true, firstName: true, lastName: true, role: true, tenantId: true, emailVerified: true },
        });
        await tx.storefront.create({ data: { name: dto.email, slug: finalSlug, tenantId: tenant.id } });
        this.eventBus.emit('user.created', { userId: newUser.id, tenantId: tenant.id });
        this.eventBus.emit('tenant.created', { tenantId: tenant.id });
        return { user: newUser, tenant };
      });

      user = result.user;
      isNewUser = true;
    }

    const tokens = this.generateTokens(user);
    return { ...tokens, isNewUser };
  }
}
