import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { SyncModule } from './sync/sync.module';

/** What `pnpm sync` needs: no HTTP server and no scheduler. */
@Module({
  imports: [ConfigModule, DatabaseModule, EmbeddingsModule, SyncModule],
})
export class SyncCliModule {}
