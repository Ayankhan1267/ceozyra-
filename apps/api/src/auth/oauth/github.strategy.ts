/**
 * ZYRA - GitHub OAuth 2.0 Strategy
 * Uses passport-github2
 */

import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as GitHubStrategyRaw } from 'passport-github2';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

export interface GitHubProfile {
  id: string;
  displayName: string;
  username: string;
  emails: { value: string; primary: boolean; verified: boolean }[];
  avatar: string | null;
  provider: 'github';
}

@Injectable()
export class GitHubStrategy extends PassportStrategy(GitHubStrategyRaw, 'github') {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID', ''),
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET', ''),
      callbackURL: configService.get<string>('GITHUB_CALLBACK_URL', '/auth/github/callback'),
      passReqToCallback: true,
      scope: ['user:email'],
    });
  }

  async validate(
    req: any,
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    const githubProfile: GitHubProfile = {
      id: profile.id,
      displayName: profile.displayName,
      username: profile.username,
      emails: (profile.emails || []).map((e: any) => ({
        value: e.value,
        primary: e.primary,
        verified: e.verified,
      })),
      avatar: profile.photos?.[0]?.value || null,
      provider: 'github',
    };

    const primaryEmail = githubProfile.emails.find((e) => e.primary)?.value;
    const email = primaryEmail || githubProfile.emails[0]?.value;

    if (!email) {
      throw new Error('No email found in GitHub profile. Ensure user:email scope is granted.');
    }

    const nameParts = (githubProfile.displayName || '').split(' ');
    const firstName = nameParts[0] || githubProfile.username;
    const lastName = nameParts.slice(1).join(' ') || '';

    return this.authService.findOrCreateOAuthUser({
      email,
      firstName,
      lastName,
      avatar: githubProfile.avatar,
      provider: 'github',
      externalId: githubProfile.id,
      accessToken,
      refreshToken,
    });
  }
}
