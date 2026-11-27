import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { HealthResponse } from '@preppilot/shared';
import type { Response } from 'express';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** 200 when every dependency is up, 503 otherwise; the body has the same shape either way. */
  @Get()
  async check(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return result;
  }
}
