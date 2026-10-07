import { DomainError } from '../../../platform/http';

export const SPEECH_PROVIDER = Symbol('SPEECH_PROVIDER');

export interface SpeechAudio {
  data: Buffer;
  filename: string;
  mimeType: string;
}

export interface Transcript {
  text: string;
  /** BCP-47 code the provider detected, such as `hi-IN`; null when it could not tell. */
  languageCode: string | null;
}

/** Speech to text and text to speech. Optional: without a key, voice is switched off. */
export interface SpeechProvider {
  readonly enabled: boolean;
  /** `languageCode` is a hint; omit it to let the provider detect the language. */
  transcribe(audio: SpeechAudio, languageCode?: string): Promise<Transcript>;
  /** Answers WAV bytes. */
  synthesize(text: string, languageCode: string): Promise<Buffer>;
}

export class SpeechNotConfiguredError extends DomainError {
  constructor() {
    super('SPEECH_NOT_CONFIGURED', 'Voice is not set up on this server', 503);
  }
}

export class SpeechUnavailableError extends DomainError {
  constructor() {
    super('SPEECH_UNAVAILABLE', 'Voice is temporarily unavailable', 503);
  }
}
