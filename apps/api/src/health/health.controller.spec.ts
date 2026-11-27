import { HttpStatus } from '@nestjs/common';
import type { HealthResponse } from '@preppilot/shared';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import type { HealthService } from './health.service';

function makeResult(status: HealthResponse['status']): HealthResponse {
  return {
    status,
    db: { status: status === 'ok' ? 'up' : 'down', latencyMs: 1 },
    uptimeSeconds: 1,
    timestamp: new Date().toISOString(),
  };
}

describe('HealthController', () => {
  function setup(result: HealthResponse) {
    const health = { check: jest.fn().mockResolvedValue(result) } as unknown as HealthService;
    const res = { status: jest.fn() } as unknown as Response;
    return { controller: new HealthController(health), res };
  }

  it('responds 200 with the health body when ok', async () => {
    const { controller, res } = setup(makeResult('ok'));

    await expect(controller.check(res)).resolves.toMatchObject({ status: 'ok' });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
  });

  it('responds 503 when degraded', async () => {
    const { controller, res } = setup(makeResult('degraded'));

    await expect(controller.check(res)).resolves.toMatchObject({ status: 'degraded' });
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
