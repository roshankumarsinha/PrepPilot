import { Global, Module } from '@nestjs/common';
import { loadEnv } from './env';

/** Injection token for the validated {@link Env}. */
export const ENV = Symbol('ENV');

@Global()
@Module({
  providers: [{ provide: ENV, useFactory: loadEnv }],
  exports: [ENV],
})
export class ConfigModule {}
