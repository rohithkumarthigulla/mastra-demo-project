import {
  SpeechUnavailableError,
  type SpeechAudio,
  type SpeechProvider,
  type Transcript,
} from '../domain';

const BASE_URL = 'https://api.sarvam.ai';

export interface SarvamConfig {
  apiKey: string;
  timeoutMs: number;
}

/** Sarvam AI (Saarika speech to text, Bulbul text to speech), built for Indian languages. */
export class SarvamSpeechProvider implements SpeechProvider {
  readonly enabled = true;

  constructor(
    private readonly config: SarvamConfig,
    private readonly fetchFn: typeof fetch = fetch,
  ) {}

  async transcribe(audio: SpeechAudio, languageCode?: string): Promise<Transcript> {
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(audio.data)], { type: audio.mimeType }),
      audio.filename,
    );
    form.append('model', 'saarika:v2.5');
    form.append('language_code', languageCode ?? 'unknown');
    const data = (await this.post('speech-to-text', form)) as {
      transcript?: string;
      language_code?: string | null;
    };
    if (typeof data.transcript !== 'string') throw new SpeechUnavailableError();
    return { text: data.transcript.trim(), languageCode: data.language_code ?? null };
  }

  async synthesize(text: string, languageCode: string): Promise<Buffer> {
    const data = (await this.post(
      'text-to-speech',
      JSON.stringify({ text, target_language_code: languageCode, model: 'bulbul:v2' }),
    )) as { audios?: string[] };
    const audios = data.audios ?? [];
    if (audios.length === 0) throw new SpeechUnavailableError();
    return Buffer.concat(audios.map((a) => Buffer.from(a, 'base64')));
  }

  private async post(path: string, body: FormData | string): Promise<unknown> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    try {
      const response = await this.fetchFn(`${BASE_URL}/${path}`, {
        method: 'POST',
        headers: {
          'api-subscription-key': this.config.apiKey,
          ...(typeof body === 'string' ? { 'content-type': 'application/json' } : {}),
        },
        body,
        signal: controller.signal,
      });
      if (!response.ok) throw new SpeechUnavailableError();
      return await response.json();
    } catch (error) {
      if (error instanceof SpeechUnavailableError) throw error;
      throw new SpeechUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  }
}
