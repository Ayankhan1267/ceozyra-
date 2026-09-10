/**
 * ZYRA — Refresh Token Guard
 */

import { Injectable } from '@nestjs/common';
import { AuthGuard as PassportAuthGuard } from '@nestjs/passport';

@Injectable()
export class RefreshTokenGuard extends PassportAuthGuard('jwt-refresh') {}
