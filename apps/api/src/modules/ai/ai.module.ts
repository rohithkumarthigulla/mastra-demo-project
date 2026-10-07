import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../platform/config';
import { AI_PROVIDER } from './domain';
import { createAiProvider } from './infrastructure';

@Module({
  providers: [
    { provide: AI_PROVIDER, useFactory: (env: Env) => createAiProvider(env), inject: [ENV] },
  ],
  exports: [AI_PROVIDER],
})
export class AiModule {}
