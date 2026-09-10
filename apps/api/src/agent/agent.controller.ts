/**
 * ZYRA — Agent Controller
 */

import { Controller, Get, Post, Body, Param, UseGuards, Patch, Query } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AgentService, type CreateAgentRunDto } from './agent.service';

@Controller('agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

  @Get('runs/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getRuns(
    @Param('tenantId') tenantId: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.agentService.getByTenant(tenantId, +page, +limit);
  }

  @Get('runs/:id')
  findRun(@Param('id') id: string) {
    return this.agentService.findById(id);
  }

  @Post('runs')
  @UseGuards(AuthGuard, RolesGuard)
  createRun(@Body() dto: CreateAgentRunDto) {
    return this.agentService.create(dto);
  }

  @Patch('runs/:id/status')
  @UseGuards(AuthGuard, RolesGuard)
  updateStatus(@Param('id') id: string, @Body() body: { status: string; output?: Record<string, unknown> }) {
    return this.agentService.updateStatus(id, body.status, body.output);
  }

  @Get('list/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getAgents(@Param('tenantId') tenantId: string) {
    return this.agentService.getAgents(tenantId);
  }

  @Get('dashboard/tenant/:tenantId')
  @UseGuards(AuthGuard, RolesGuard)
  getDashboard(@Param('tenantId') tenantId: string) {
    return this.agentService.getDashboardData(tenantId);
  }
}
