import {
  SpeechNotConfiguredError,
  type SpeechAudio,
  type SpeechProvider,
  type Transcript,
} from '../domain';

/**
 * Deterministic speech for tests and keyless demos. "Audio" in is UTF-8 text, optionally
 * prefixed with a language code (`hi-IN|नमस्ते`); audio out is a short silent WAV whose
 * length grows with the text.
 */
export class FakeSpeechProvider implements SpeechProvider {
  readonly enabled = true;

  transcribe(audio: SpeechAudio, languageCode?: string): Promise<Transcript> {
    const raw = audio.data.toString('utf8').trim();
    const match = /^([a-z]{2}-IN)\|(.*)$/s.exec(raw);
    return Promise.resolve({
      text: (match?.[2] ?? raw).trim(),
      languageCode: match?.[1] ?? languageCode ?? null,
    });
  }

  synthesize(text: string): Promise<Buffer> {
    return Promise.resolve(silentWav(text.length * 80));
  }
}

export class UnconfiguredSpeechProvider implements SpeechProvider {
  readonly enabled = false;

  transcribe(): Promise<Transcript> {
    return Promise.reject(new SpeechNotConfiguredError());
  }

  synthesize(): Promise<Buffer> {
    return Promise.reject(new SpeechNotConfiguredError());
  }
}

const SAMPLE_RATE = 8000;

export function silentWav(samples: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + samples, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE, 28);
  header.writeUInt16LE(1, 32);
  header.writeUInt16LE(8, 34);
  header.write('data', 36);
  header.writeUInt32LE(samples, 40);
  return Buffer.concat([header, Buffer.alloc(samples, 128)]);
}
