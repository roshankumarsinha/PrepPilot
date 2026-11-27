import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ENV } from './config/config.module';
import type { Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const { PORT } = app.get<Env>(ENV);
  await app.listen(PORT);
  Logger.log(`API listening on http://localhost:${PORT}`, 'Bootstrap');
}

void bootstrap();
