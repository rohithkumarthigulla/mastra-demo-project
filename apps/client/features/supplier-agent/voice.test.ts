import type { AgentLanguage, AgentReplyDto, PendingActionDto } from '@ee/contracts';
import { describe, expect, it } from 'vitest';
import {
  activityLabel,
  levelFromDb,
  sentences,
  SilenceDetector,
  speakableText,
  VoiceCall,
  type PreparedSpeech,
  type VoicePorts,
  type VoiceState,
} from './voice';

const ID = '3f1c2a7e-5b4d-4c1e-9a2b-0c8d7e6f5a41';

describe('speakableText', () => {
  it('drops serial numbers, ids and raw dates that are already on screen', () => {
    const text =
      `Big Digger (serial number CAT320-0042) is blocked from 2026-10-10 to 2026-10-12. ` +
      `Request ${ID} is waiting. S/N: 88412 is free on 12/10/2026.`;
    const spoken = speakableText(text);
    expect(spoken).not.toMatch(/CAT320|0042|88412|2026|3f1c2a7e/);
    expect(spoken).toBe('Big Digger is blocked. Request is waiting. is free.');
  });

  it('keeps ordinary words, numbers and Indian scripts', () => {
    expect(speakableText('You have 3 machines, priced at ₹12500 a day.')).toBe(
      'You have 3 machines, priced at ₹12500 a day.',
    );
    expect(speakableText('मशीन **ब्लॉक** कर दी गई है।')).toBe('मशीन ब्लॉक कर दी गई है।');
  });
});

describe('sentences', () => {
  it('splits on full stops, question marks and the danda', () => {
    expect(sentences('Done. Anything else? हाँ। ठीक है')).toEqual([
      'Done.',
      'Anything else?',
      'हाँ।',
      'ठीक है',
    ]);
  });

  it('keeps every piece within the speech limit', () => {
    const long = Array.from({ length: 200 }, () => 'word').join(' ');
    const parts = sentences(long, 50);
    expect(parts.every((p) => p.length <= 50)).toBe(true);
    expect(parts.join(' ')).toBe(long);
  });
});

describe('SilenceDetector', () => {
  it('ends after speech followed by silence', () => {
    const d = new SilenceDetector(0);
    expect(d.sample(-70, 100)).toBe('continue');
    expect(d.sample(-20, 500)).toBe('continue');
    expect(d.sample(-70, 900)).toBe('continue');
    expect(d.sample(-70, 2200)).toBe('speech-ended');
  });

  it('gives up when nothing is said', () => {
    const d = new SilenceDetector(0);
    expect(d.sample(-70, 9_000)).toBe('continue');
    expect(d.sample(-70, 10_000)).toBe('nothing-heard');
  });

  it('maps levels for the indicator', () => {
    expect(levelFromDb(undefined)).toBe(0);
    expect(levelFromDb(-60)).toBe(0);
    expect(levelFromDb(0)).toBe(1);
  });
});

function reply(content: string, language: AgentLanguage, action = false): AgentReplyDto {
  return {
    message: {
      id: crypto.randomUUID(),
      role: 'ASSISTANT',
      content,
      citedDocumentIds: [],
      createdAt: '',
    },
    citations: [],
    language,
    pendingAction: action ? ({ id: ID } as PendingActionDto) : null,
  };
}

/** Fake device + server; records every step so ordering can be asserted. */
function fakePorts(
  script: { heard: string; spoken: AgentLanguage | null; reply: AgentReplyDto }[],
  onScriptDone: () => void = () => {},
) {
  const log: string[] = [];
  let turn = 0;
  let playing = 0;
  const ports: VoicePorts<string> = {
    listen: async (signal, onLevel) => {
      log.push('listen');
      if (playing > 0) throw new Error('listened while speaking');
      if (turn >= script.length) {
        queueMicrotask(onScriptDone);
        await new Promise<void>((resolve) => signal.addEventListener('abort', () => resolve()));
        return null;
      }
      onLevel(0.8);
      return script[turn]!.heard;
    },
    transcribe: async (recording) => {
      log.push(`transcribe ${recording}`);
      return { text: recording, language: script[turn]!.spoken };
    },
    ask: async (text, spoken, onActivity) => {
      log.push(`ask ${text} (${spoken ?? 'typed'})`);
      onActivity(activityLabel('CHECKING_AVAILABILITY'));
      return script[turn++]!.reply;
    },
    prepare: (sentence, language): PreparedSpeech => {
      log.push(`prepare ${language}: ${sentence}`);
      return {
        play: async () => {
          playing++;
          log.push(`play ${sentence}`);
          await Promise.resolve();
          playing--;
        },
        release: () => {},
      };
    },
  };
  return { ports, log };
}

describe('VoiceCall', () => {
  it('runs a full turn: speech in, answer, speech out sentence by sentence, then listens', async () => {
    const ref: { call?: VoiceCall<string> } = {};
    const { ports, log } = fakePorts(
      [
        {
          heard: 'क्या बड़ा खुदाई वाला खाली है?',
          spoken: 'hi',
          reply: reply('हाँ, खाली है। 2026-10-10 से बुक करें?', 'hi'),
        },
      ],
      () => ref.call?.hangUp(),
    );
    const states: VoiceState[] = [];
    const call = (ref.call = new VoiceCall(ports, (s) => states.push(s)));
    expect(await call.start()).toBe('hung-up');

    expect(log).toEqual([
      'listen',
      'transcribe क्या बड़ा खुदाई वाला खाली है?',
      'ask क्या बड़ा खुदाई वाला खाली है? (hi)',
      'prepare hi: हाँ, खाली है।',
      'prepare hi: से बुक करें?',
      'play हाँ, खाली है।',
      'play से बुक करें?',
      'listen',
    ]);
    expect(states.map((s) => s.phase)).toEqual([
      'listening',
      'listening',
      'thinking',
      'thinking',
      'thinking',
      'speaking',
      'listening',
      'idle',
    ]);
    expect(states).toContainEqual({ phase: 'thinking', label: 'Checking availability…' });
    expect(JSON.stringify(states)).not.toMatch(/get_availability|list_/);
  });

  it('stops when a reply needs a confirmation on screen', async () => {
    const { ports, log } = fakePorts([
      { heard: 'block it', spoken: 'en', reply: reply('Please confirm below.', 'en', true) },
      { heard: 'never asked', spoken: 'en', reply: reply('No.', 'en') },
    ]);
    const call = new VoiceCall(ports, () => {});
    expect(await call.start()).toBe('pending-action');
    expect(log.at(-1)).toBe('play Please confirm below.');
    expect(log.filter((l) => l === 'listen')).toHaveLength(1);
  });

  it('can be interrupted while speaking and goes back to listening', async () => {
    const ref: { call?: VoiceCall<string> } = {};
    const { ports, log } = fakePorts(
      [{ heard: 'tell me', spoken: 'en', reply: reply('One. Two. Three.', 'en') }],
      () => ref.call?.hangUp(),
    );
    const play = ports.prepare;
    ports.prepare = (sentence, language) => {
      const prepared = play(sentence, language);
      return {
        ...prepared,
        play: async (signal) => {
          await prepared.play(signal);
          if (sentence === 'One.') call?.interrupt();
        },
      };
    };
    const call = (ref.call = new VoiceCall(ports, () => {}));
    expect(await call.start()).toBe('hung-up');
    expect(log.filter((l) => l.startsWith('play'))).toEqual(['play One.']);
    expect(log.at(-1)).toBe('listen');
  });

  it('ends the call when nothing more is said', async () => {
    const { ports, log } = fakePorts([
      { heard: 'hello', spoken: 'en', reply: reply('Hello there.', 'en') },
    ]);
    ports.listen = async () => {
      log.push('listen');
      return log.filter((l) => l === 'listen').length === 1 ? 'hello' : null;
    };
    const call = new VoiceCall(ports, () => {});
    expect(await call.start()).toBe('quiet');
    expect(log.filter((l) => l === 'listen')).toHaveLength(2);
  });

  it('reports an error and ends the call', async () => {
    const { ports } = fakePorts([{ heard: 'hi', spoken: null, reply: reply('x', 'en') }]);
    ports.transcribe = async () => {
      throw new Error('offline');
    };
    const errors: unknown[] = [];
    const call = new VoiceCall(
      ports,
      () => {},
      (e) => errors.push(e),
    );
    expect(await call.start()).toBe('error');
    expect(errors).toHaveLength(1);
  });
});
