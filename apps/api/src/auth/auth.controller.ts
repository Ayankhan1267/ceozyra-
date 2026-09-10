/**
 * ZYRA — Auth Controller
 */

import { Controller, Post, Body, UseGuards, Request, Get, Patch, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { AuthService, type RegisterDto, type LoginDto } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(RefreshTokenGuard)
  @Post('refresh')
  async refresh(@Request() req: any) {
    const user = await this.authService.validateUser(req.user.sub);
    if (!user) throw new UnauthorizedException('Invalid refresh token');
    return this.authService.generateTokens(user);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async me(@Request() req: any) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(AuthGuard)
  @Patch('change-password')
  async changePassword(@Request() req: any, @Body() body: { oldPassword: string; newPassword: string }) {
    return this.authService.changePassword(req.user.sub, body.oldPassword, body.newPassword);
  }
}
