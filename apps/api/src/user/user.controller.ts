/**
 * ZYRA — User Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Delete, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard, Roles } from '../auth/roles.guard';
import { UserService, type CreateUserDto } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findById(id);
  }

  @Get()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  findByTenant(@Query('tenantId') tenantId: string, @Query('page') page = '1', @Query('limit') limit = '20') {
    return this.userService.findByTenant(tenantId, +page, +limit);
  }

  @Post()
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  create(@Body() dto: CreateUserDto) {
    return this.userService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() data: Record<string, unknown>) {
    return this.userService.update(id, data);
  }

  @Patch(':id/role')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SUPER_ADMIN')
  updateRole(@Param('id') id: string, @Body() body: { role: string }) {
    return this.userService.updateRole(id, body.role);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('OWNER', 'SUPER_ADMIN')
  delete(@Param('id') id: string) {
    return this.userService.delete(id);
  }
}
