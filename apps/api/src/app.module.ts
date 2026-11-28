import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { HealthModule } from './health/health.module';
import { SyncSchedulerModule } from './sync/sync-scheduler.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    EmbeddingsModule,
    HealthModule,
    SyncModule,
    SyncSchedulerModule,
  ],
})
export class AppModule {}
