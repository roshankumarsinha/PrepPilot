import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import type { RepoSummary, SyncRun, SyncStarted } from '@preppilot/shared';
import { z } from 'zod';
import { IndexRepository } from './index.repository';
import { SyncService } from './sync.service';
import { SyncBusyError, UnknownRepoError } from './sync.types';

const RunsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  repo: z.string().min(1).optional(),
});

@Controller()
export class SyncController {
  constructor(
    private readonly sync: SyncService,
    private readonly index: IndexRepository,
  ) {}

  /** Starts syncing every repo in the background; 409 if a sync is already running. */
  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncAll(): Promise<SyncStarted> {
    return { started: true, repos: await this.startSync() };
  }

  /** Starts syncing one repo; 404 if it is not in repos.yaml. */
  @Post('sync/:repo')
  @HttpCode(HttpStatus.ACCEPTED)
  async syncOne(@Param('repo') repo: string): Promise<SyncStarted> {
    return { started: true, repos: await this.startSync(repo) };
  }

  /** The sync log, newest first. */
  @Get('sync/runs')
  async runs(@Query() query: Record<string, unknown>): Promise<SyncRun[]> {
    const parsed = RunsQuerySchema.safeParse(query);
    if (!parsed.success) throw new BadRequestException(z.prettifyError(parsed.error));
    return this.index.listRuns(parsed.data);
  }

  @Get('repos')
  repos(): Promise<RepoSummary[]> {
    return this.index.listRepos();
  }

  private async startSync(repo?: string): Promise<string[]> {
    try {
      return await this.sync.start({ trigger: 'manual', repo });
    } catch (error) {
      if (error instanceof SyncBusyError) throw new ConflictException(error.message);
      if (error instanceof UnknownRepoError) throw new NotFoundException(error.message);
      throw error;
    }
  }
}
