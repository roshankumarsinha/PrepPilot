import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { SyncService } from './sync.service';
import { SyncBusyError } from './sync.types';

const JOB_NAME = 'sync-repos';

/** Runs the sync on the `SYNC_CRON` schedule (every 15 minutes by default). */
@Injectable()
export class SyncScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncScheduler.name);

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly sync: SyncService,
    private readonly registry: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.env.SYNC_SCHEDULE_ENABLED) {
      this.logger.log('Scheduled sync is disabled (SYNC_SCHEDULE_ENABLED=false)');
      return;
    }
    const job = CronJob.from({ cronTime: this.env.SYNC_CRON, onTick: () => this.tick() });
    this.registry.addCronJob(JOB_NAME, job);
    job.start();
    this.logger.log(`Scheduled sync: "${this.env.SYNC_CRON}"`);
  }

  async tick(): Promise<void> {
    try {
      await this.sync.runNow({ trigger: 'schedule' });
    } catch (error) {
      if (error instanceof SyncBusyError) {
        this.logger.log('Skipping scheduled sync: another sync is running');
        return;
      }
      this.logger.error(`Scheduled sync failed: ${(error as Error).message}`);
    }
  }
}
