import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SyncModule } from './sync.module';
import { SyncScheduler } from './sync.scheduler';

/** Only the API server imports this; the CLI syncs once and exits. */
@Module({
  imports: [ScheduleModule.forRoot(), SyncModule],
  providers: [SyncScheduler],
})
export class SyncSchedulerModule {}
