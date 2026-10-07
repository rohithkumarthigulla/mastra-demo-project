import {
  SPEECH_TEXT_MAX,
  type AgentActivity,
  type AgentLanguage,
  type AgentReplyDto,
} from '@ee/contracts';

/** Plain words for what the agent is doing; tool names never reach the screen or the speaker. */
export const ACTIVITY_LABEL: Record<AgentActivity, string> = {
  READING_GUIDES: 'Reading the guides…',
  CHECKING_FLEET: 'Checking your fleet…',
  CHECKING_AVAILABILITY: 'Checking availability…',
  CHECKING_LISTINGS: 'Checking your listings…',
  CHECKING_REQUESTS: 'Checking rental requests…',
  PREPARING_CHANGE: 'Preparing the change…',
};

export function activityLabel(activity: AgentActivity | null): string {
  return activity ? ACTIVITY_LABEL[activity] : 'Thinking…';
}

const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const ISO_DATE =
  /\b\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?\b/g;
const SLASH_DATE = /\b\d{1,2}[/.]\d{1,2}[/.]\d{2,4}\b/g;
/** "serial number ABC-123", "S/N: 12345", "serial 4471" */
const SERIAL_PHRASE = /\b(?:serial(?:\s+(?:number|no\.?))?|s\/n)\s*[:#]?\s*[A-Za-z0-9][\w-]*/gi;
/** Codes mixing letters and digits, like CAT320-0042 or EX200LC7. */
const CODE =
  /\b(?=[A-Za-z0-9-]*\d)(?=[A-Za-z0-9-]*[A-Za-z])[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+\b|\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{5,}\b/g;

/**
 * Text worth saying aloud. Serial numbers, ids and raw dates are already on screen and are
 * noise when spoken, so they are dropped along with markdown symbols.
 */
export function speakableText(text: string): string {
  return (
    text
      .replace(UUID, '')
      .replace(ISO_DATE, '')
      .replace(SLASH_DATE, '')
      .replace(SERIAL_PHRASE, '')
      .replace(CODE, '')
      .replace(/[*_#`>|[\]]/g, '')
      .replace(/^\s*[-•]\s+/gm, '')
      .replace(/\(\s*[,;:–-]*\s*\)/g, '')
      // Words left dangling where a date or code was: "blocked from  to ." → "blocked."
      .replace(
        /\s+(?:from|to|on|until|between|and)(?=(?:\s+(?:from|to|on|until|and))*\s*(?:[.,;!?।]|$))/gim,
        '',
      )
      .replace(/[ \t]+/g, ' ')
      .replace(/\s+([,.;:!?।])/g, '$1')
      .replace(/([,;:])(?:\s*[,;:])+/g, '$1')
      .replace(/ *\n */g, '\n')
      .trim()
  );
}

/** Splits a reply into sentences (including the Devanagari danda) of at most `max` characters. */
export function sentences(text: string, max = SPEECH_TEXT_MAX): string[] {
  const parts = text
    .split(/(?<=[.!?।॥])\s+|\n+/u)
    .map((s) => s.trim())
    .filter((s) => /[\p{L}\p{N}]/u.test(s));
  return parts.flatMap((s) => chunk(s, max));
}

function chunk(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence];
  const out: string[] = [];
  let current = '';
  for (const word of sentence.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > max && current) {
      out.push(current);
      current = word.slice(0, max);
    } else {
      current = next.slice(0, max);
    }
  }
  if (current) out.push(current);
  return out;
}

/** The sentences to speak for one reply. */
export function spokenSentences(reply: AgentReplyDto): string[] {
  return sentences(speakableText(reply.message.content));
}

/** Decides when a recording is over from microphone levels (dBFS). */
export class SilenceDetector {
  private heardAt: number | null = null;
  private quietSince: number | null = null;

  constructor(
    private readonly startedAt: number,
    private readonly options = {
      /** Louder than this counts as speech. */
      speechDb: -45,
      /** Stop after this much quiet once speech was heard. */
      silenceMs: 1200,
      /** Give up if nothing is said for this long. */
      idleMs: 10_000,
      /** Never record longer than this. */
      maxMs: 30_000,
    },
  ) {}

  /** `speech-ended` and `nothing-heard` end the recording; `continue` keeps listening. */
  sample(levelDb: number | undefined, at: number): 'continue' | 'speech-ended' | 'nothing-heard' {
    const loud = levelDb !== undefined && levelDb > this.options.speechDb;
    if (loud) {
      this.heardAt ??= at;
      this.quietSince = null;
    } else if (this.heardAt !== null) {
      this.quietSince ??= at;
    }
    if (at - this.startedAt >= this.options.maxMs) {
      return this.heardAt === null ? 'nothing-heard' : 'speech-ended';
    }
    if (this.heardAt === null) {
      return at - this.startedAt >= this.options.idleMs ? 'nothing-heard' : 'continue';
    }
    return this.quietSince !== null && at - this.quietSince >= this.options.silenceMs
      ? 'speech-ended'
      : 'continue';
  }
}

/** Microphone level 0..1 for the animated indicator. */
export function levelFromDb(levelDb: number | undefined): number {
  if (levelDb === undefined || !Number.isFinite(levelDb)) return 0;
  return Math.min(1, Math.max(0, (levelDb + 60) / 60));
}

export type VoiceState =
  | { phase: 'idle' }
  | { phase: 'listening'; level: number }
  | { phase: 'thinking'; label: string }
  | { phase: 'speaking' };

export type VoiceEndReason = 'hung-up' | 'quiet' | 'pending-action' | 'error';

/** A playable sentence that is already being fetched. */
export interface PreparedSpeech {
  play(signal: AbortSignal): Promise<void>;
  release(): void;
}

/** Everything the call needs from the device and the server; fakes make it testable. */
export interface VoicePorts<Recording> {
  /** Records until the speaker goes quiet; null when nothing was said. */
  listen(signal: AbortSignal, onLevel: (level: number) => void): Promise<Recording | null>;
  transcribe(recording: Recording): Promise<{ text: string; language: AgentLanguage | null }>;
  /** Sends the transcript; `onActivity` reports progress while the agent works. */
  ask(
    text: string,
    spokenLanguage: AgentLanguage | null,
    onActivity: (label: string) => void,
  ): Promise<AgentReplyDto>;
  prepare(sentence: string, language: AgentLanguage): PreparedSpeech;
}

/**
 * A voice call with the agent: listening → (silence) → thinking → speaking → listening.
 * It never listens while speaking, and ends when a reply needs a confirmation on screen.
 */
export class VoiceCall<Recording> {
  private state: VoiceState = { phase: 'idle' };
  private hangup = new AbortController();
  private speech: AbortController | null = null;
  private running: Promise<VoiceEndReason> | null = null;

  constructor(
    private readonly ports: VoicePorts<Recording>,
    private readonly onState: (state: VoiceState) => void,
    private readonly onError: (error: unknown) => void = () => {},
  ) {}

  get phase(): VoiceState['phase'] {
    return this.state.phase;
  }

  start(): Promise<VoiceEndReason> {
    this.running ??= this.run().finally(() => this.set({ phase: 'idle' }));
    return this.running;
  }

  /** Ends the call wherever it is. */
  hangUp(): void {
    this.hangup.abort();
    this.speech?.abort();
  }

  /** Cuts the current reply short and goes back to listening. */
  interrupt(): void {
    this.speech?.abort();
  }

  private set(state: VoiceState): void {
    this.state = state;
    this.onState(state);
  }

  private async run(): Promise<VoiceEndReason> {
    const ended = this.hangup.signal;
    try {
      while (!ended.aborted) {
        this.set({ phase: 'listening', level: 0 });
        const recording = await this.ports.listen(ended, (level) => {
          if (this.state.phase === 'listening') this.set({ phase: 'listening', level });
        });
        if (ended.aborted) break;
        // Nobody spoke for a while: the task is over, so stop holding the microphone.
        if (recording === null) return 'quiet';

        this.set({ phase: 'thinking', label: 'Listening back…' });
        const heard = await this.ports.transcribe(recording);
        if (ended.aborted) break;
        if (!heard.text.trim()) continue;

        this.set({ phase: 'thinking', label: activityLabel(null) });
        const reply = await this.ports.ask(heard.text, heard.language, (label) => {
          if (this.state.phase === 'thinking') this.set({ phase: 'thinking', label });
        });
        if (ended.aborted) break;

        await this.speak(spokenSentences(reply), reply.language);
        if (ended.aborted) break;
        if (reply.pendingAction) return 'pending-action';
      }
      return 'hung-up';
    } catch (error) {
      if (ended.aborted) return 'hung-up';
      this.onError(error);
      return 'error';
    }
  }

  /** Plays sentences in order, fetching the next one while the current one plays. */
  private async speak(lines: string[], language: AgentLanguage): Promise<void> {
    if (lines.length === 0) return;
    const speech = new AbortController();
    this.speech = speech;
    this.set({ phase: 'speaking' });
    let next: PreparedSpeech | null = this.ports.prepare(lines[0]!, language);
    try {
      for (let i = 0; i < lines.length && next && !speech.signal.aborted; i++) {
        const current: PreparedSpeech = next;
        next = i + 1 < lines.length ? this.ports.prepare(lines[i + 1]!, language) : null;
        try {
          await current.play(speech.signal);
        } finally {
          current.release();
        }
      }
    } finally {
      next?.release();
      this.speech = null;
    }
  }
}
