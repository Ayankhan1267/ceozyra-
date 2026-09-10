/**
 * ZYRA - Google OAuth 2.0 Strategy
 * Uses passport-google-oauth20
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService, type OAuthUserRecord } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID', ''),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', ''),
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL', '/auth/google/callback'),
      passReqToCallback: true,
      scope: ['profile', 'email'],
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<OAuthUserRecord> {
    const emails = profile.emails || [];
    const email = emails.find((e: any) => e.verified)?.value || emails[0]?.value;
    if (!email) throw new Error('No email found in Google profile');

    const givenName = profile.name?.givenName || profile.displayName?.split(' ')[0] || '';
    const familyName = profile.name?.familyName || '';
    const picture = profile.photos?.[0]?.value || null;

    return this.authService.findOrCreateOAuthUser({
      email,
      firstName: givenName,
      lastName: familyName,
      avatar: picture,
      provider: 'google',
      externalId: profile.id,
      accessToken,
      refreshToken,
    });
  }
}
