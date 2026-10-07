import { Module } from '@nestjs/common';
import { ENV, type Env } from '../../platform/config';
import { AI_PROVIDER, SPEECH_PROVIDER } from './domain';
import { createAiProvider, createSpeechProvider } from './infrastructure';

@Module({
  providers: [
    { provide: AI_PROVIDER, useFactory: (env: Env) => createAiProvider(env), inject: [ENV] },
    {
      provide: SPEECH_PROVIDER,
      useFactory: (env: Env) => createSpeechProvider(env),
      inject: [ENV],
    },
  ],
  exports: [AI_PROVIDER, SPEECH_PROVIDER],
})
export class AiModule {}
