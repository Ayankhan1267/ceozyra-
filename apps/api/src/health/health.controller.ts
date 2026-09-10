/**
 * ZYRA — Health Controller
 *
 * Liveness    GET /health     — lightweight probe (no DB/Redis hits)
 * Readiness   GET /health/deep — full dependency check (DB, Redis, disk, memory)
 */

import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async check() {
    return this.healthService.check();
  }

  @Get('deep')
  async deepCheck() {
    return this.healthService.deepCheck();
  }
}
