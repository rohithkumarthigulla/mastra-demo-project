import { type AgentLanguage, type AgentReplyDto } from '@ee/contracts';
import {
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  type AudioPlayer,
  type AudioRecorder,
} from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { speechAudioQuery, type ApiClient, type UploadFile } from '../../api';
import {
  activityLabel,
  levelFromDb,
  SilenceDetector,
  VoiceCall,
  type PreparedSpeech,
  type VoiceEndReason,
  type VoicePorts,
  type VoiceState,
} from './voice';

const RECORDING = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  isMeteringEnabled: true,
};
const SAMPLE_MS = 100;
const PROGRESS_MS = 700;

export const MIC_REFUSED_MESSAGE =
  'Microphone access is off, so voice is unavailable. You can keep typing, or allow the microphone in your settings and try again.';

interface Options {
  api: ApiClient;
  /** Sends what was heard and returns the agent's reply (also shown in the chat). */
  ask: (
    text: string,
    spoken: AgentLanguage | null,
  ) => Promise<{ conversationId: string; reply: AgentReplyDto }>;
  /** Language picked on this device; a hint for recognition. */
  language: AgentLanguage;
  /** Conversation that will receive the next message, for progress while thinking. */
  conversationId: () => string | null;
}

/** Runs a {@link VoiceCall} on this device's microphone and speaker. */
export function useVoiceCall({ api, ask, language, conversationId }: Options) {
  const recorder = useAudioRecorder(RECORDING);
  const [state, setState] = useState<VoiceState>({ phase: 'idle' });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const call = useRef<VoiceCall<UploadFile> | null>(null);
  const latest = useRef({ ask, language, conversationId });
  latest.current = { ask, language, conversationId };

  useEffect(() => () => call.current?.hangUp(), []);

  const start = async (): Promise<VoiceEndReason | null> => {
    if (call.current) return null;
    setError(null);
    setNotice(null);
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setNotice(MIC_REFUSED_MESSAGE);
      return null;
    }
    const ports: VoicePorts<UploadFile> = {
      listen: (signal, onLevel) => listen(recorder, signal, onLevel),
      transcribe: (recording) =>
        api.supplierAgent.transcribe(recording, { language: latest.current.language }),
      ask: async (text, spoken, onActivity) => {
        const stop = pollProgress(api, latest.current.conversationId, onActivity);
        try {
          return (await latest.current.ask(text, spoken)).reply;
        } finally {
          stop();
        }
      },
      prepare: (sentence, language) => prepare(api, sentence, language),
    };
    const current = new VoiceCall(ports, setState, setError);
    call.current = current;
    try {
      return await current.start();
    } finally {
      call.current = null;
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  };

  return {
    state,
    notice,
    error,
    active: state.phase !== 'idle',
    start: () => void start(),
    hangUp: () => call.current?.hangUp(),
    /** Tapping the indicator while it speaks cuts the reply short; otherwise it ends the call. */
    tap: () =>
      call.current?.phase === 'speaking' ? call.current.interrupt() : call.current?.hangUp(),
  };
}

async function listen(
  recorder: AudioRecorder,
  signal: AbortSignal,
  onLevel: (level: number) => void,
): Promise<UploadFile | null> {
  await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
  await recorder.prepareToRecordAsync();
  recorder.record();
  const detector = new SilenceDetector(Date.now());
  let outcome: 'speech-ended' | 'nothing-heard' | 'aborted';
  try {
    outcome = await new Promise((resolve) => {
      const timer = setInterval(() => {
        const { metering } = recorder.getStatus();
        onLevel(levelFromDb(metering));
        const result = detector.sample(metering, Date.now());
        if (result !== 'continue') finish(result);
      }, SAMPLE_MS);
      const onAbort = () => finish('aborted');
      signal.addEventListener('abort', onAbort);
      function finish(value: 'speech-ended' | 'nothing-heard' | 'aborted') {
        clearInterval(timer);
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      }
    });
  } finally {
    await recorder.stop();
    // Release the microphone before anything is played back.
    await setAudioModeAsync({ allowsRecording: false });
  }
  if (outcome !== 'speech-ended' || !recorder.uri) return null;
  if (Platform.OS === 'web') return (await fetch(recorder.uri)).blob();
  return { uri: recorder.uri, name: 'speech.m4a', type: 'audio/mp4' };
}

/** Reports progress while a reply is in flight; returns a function that stops polling. */
function pollProgress(
  api: ApiClient,
  conversationId: () => string | null,
  onActivity: (label: string) => void,
): () => void {
  let stopped = false;
  const tick = async () => {
    const id = conversationId();
    if (stopped || !id) return;
    try {
      const { activity } = await api.supplierAgent.progress(id);
      if (!stopped && activity) onActivity(activityLabel(activity));
    } catch {
      // Progress is a nicety; the reply itself reports failures.
    }
  };
  const timer = setInterval(() => void tick(), PROGRESS_MS);
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** Starts fetching a sentence's audio now so it is ready when its turn comes. */
function prepare(api: ApiClient, sentence: string, language: AgentLanguage): PreparedSpeech {
  const query = { text: sentence, language };
  let objectUrl: string | null = null;
  let player: AudioPlayer | null = null;
  const source = (async () => {
    if (Platform.OS === 'web') {
      objectUrl = URL.createObjectURL(await api.supplierAgent.synthesize(query));
      return { uri: objectUrl };
    }
    const token = await api.accessToken();
    return {
      uri: `${api.baseUrl}/supplier-agent/speech/audio${speechAudioQuery(query)}`,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
  })();
  source.catch(() => {});

  return {
    play: async (signal) => {
      const resolved = await source;
      if (signal.aborted) return;
      const current = createAudioPlayer(resolved);
      player = current;
      await new Promise<void>((resolve) => {
        const sub = current.addListener('playbackStatusUpdate', (status) => {
          if (status.didJustFinish) done();
        });
        const onAbort = () => {
          current.pause();
          done();
        };
        signal.addEventListener('abort', onAbort);
        function done() {
          sub.remove();
          signal.removeEventListener('abort', onAbort);
          resolve();
        }
        current.play();
      });
    },
    release: () => {
      player?.remove();
      player = null;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    },
  };
}
