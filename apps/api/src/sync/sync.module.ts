import { Module } from '@nestjs/common';
import { GitClient } from '../git/git.client';
import { IndexRepository } from './index.repository';
import { SyncLock } from './sync-lock';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, IndexRepository, SyncLock, GitClient],
  exports: [SyncService, IndexRepository],
})
export class SyncModule {}
