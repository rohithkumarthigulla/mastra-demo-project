import { Inject, Injectable } from '@nestjs/common';
import {
  agentLanguage,
  agentLanguageFromSpeechCode,
  type SpeechStatusDto,
  type SynthesizeQuery,
  type TranscribeQuery,
  type TranscriptionDto,
} from '@ee/contracts';
import {
  SPEECH_PROVIDER,
  SpeechNotConfiguredError,
  type SpeechAudio,
  type SpeechProvider,
} from '../../ai/domain';

/** The supplier agent's voice: speech to text in, text to speech out. */
@Injectable()
export class AgentSpeechService {
  constructor(@Inject(SPEECH_PROVIDER) private readonly speech: SpeechProvider) {}

  status(): SpeechStatusDto {
    return { enabled: this.speech.enabled };
  }

  async transcribe(audio: SpeechAudio, query: TranscribeQuery): Promise<TranscriptionDto> {
    this.requireEnabled();
    const hint = query.language ? agentLanguage(query.language).speechCode : undefined;
    const transcript = await this.speech.transcribe(audio, hint);
    return {
      text: transcript.text,
      language: agentLanguageFromSpeechCode(transcript.languageCode),
    };
  }

  synthesize(query: SynthesizeQuery): Promise<Buffer> {
    this.requireEnabled();
    return this.speech.synthesize(query.text, agentLanguage(query.language).speechCode);
  }

  private requireEnabled(): void {
    if (!this.speech.enabled) throw new SpeechNotConfiguredError();
  }
}
