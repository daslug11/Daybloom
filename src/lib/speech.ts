import type { VoiceSettings } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any */
type RecognitionCtor = new () => any;

/** The browser's SpeechRecognition (Chrome/Edge/Safari prefix it), or null if unsupported. */
export function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const speechInputSupported = () => recognitionCtor() !== null;
export const speechOutputSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

export interface Recognizer {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

/** Thin wrapper around SpeechRecognition with friendly error messages. */
export function createRecognizer(opts: {
  continuous?: boolean;
  lang?: string;
  onText: (text: string, isFinal: boolean) => void;
  onEnd?: () => void;
  /** `code` is the SpeechRecognition error ('no-speech', 'not-allowed', …); `message` is empty for a plain abort. */
  onError?: (message: string, code: string) => void;
}): Recognizer | null {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = !!opts.continuous;
  rec.interimResults = true;
  rec.lang = opts.lang ?? (navigator.language || 'en-GB');
  rec.onresult = (e: any) => {
    let interim = '';
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) final += r[0].transcript;
      else interim += r[0].transcript;
    }
    if (final) opts.onText(final.trim(), true);
    else if (interim) opts.onText(interim.trim(), false);
  };
  rec.onerror = (e: any) => {
    const messages: Record<string, string> = {
      'not-allowed': 'Microphone access was blocked. Allow it in your browser settings to use voice.',
      'service-not-allowed': 'Speech recognition is turned off in this browser.',
      'no-speech': "I didn't catch anything — try again.",
      'audio-capture': 'No microphone was found.',
      network: 'Speech recognition needs an internet connection.',
      aborted: '',
    };
    const msg = messages[e.error] ?? 'Voice input stopped unexpectedly.';
    if (msg) opts.onError?.(msg, String(e.error));
  };
  rec.onend = () => opts.onEnd?.();
  return {
    start: () => {
      try {
        rec.start();
      } catch {
        /* already started */
      }
    },
    stop: () => rec.stop(),
    abort: () => rec.abort(),
  };
}

const MALE_HINTS = /(male|daniel|arthur|george|oliver|ryan|thomas|james|harry|rishi|malcolm|reed|eddy|rocko)/i;
const FEMALE_HINTS = /(female|serena|kate|stephanie|martha|susan|hazel|libby|sonia|fiona|moira|tessa|karen|samantha|victoria)/i;

export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!speechOutputSupported()) return Promise.resolve([]);
  const existing = speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const done = () => resolve(speechSynthesis.getVoices());
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

/** Atlas's voice: the user's pick, else an en-GB male voice, else any en-GB, else any English voice. */
export function pickVoice(voices: SpeechSynthesisVoice[], preferredURI?: string) {
  if (preferredURI) {
    const chosen = voices.find((v) => v.voiceURI === preferredURI);
    if (chosen) return chosen;
  }
  const gb = voices.filter((v) => /en[-_]GB/i.test(v.lang));
  return (
    gb.find((v) => MALE_HINTS.test(v.name) && !FEMALE_HINTS.test(v.name)) ??
    gb.find((v) => !FEMALE_HINTS.test(v.name)) ??
    gb[0] ??
    voices.find((v) => /^en/i.test(v.lang) && MALE_HINTS.test(v.name)) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    voices[0] ??
    null
  );
}

/** Speaks text; resolves when finished (or immediately if speech output is unavailable). */
export async function speak(text: string, settings: VoiceSettings = {}, hooks: { onStart?: () => void; onBoundary?: () => void } = {}): Promise<void> {
  if (!speechOutputSupported() || !text.trim()) return;
  const voices = await loadVoices();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[*_`#>]/g, ''));
  const voice = pickVoice(voices, settings.voiceURI);
  if (voice) {
    u.voice = voice;
    u.lang = voice.lang;
  } else u.lang = 'en-GB';
  u.pitch = settings.pitch ?? 0.85;
  u.rate = settings.rate ?? 1;
  return new Promise((resolve) => {
    u.onstart = () => hooks.onStart?.();
    u.onboundary = () => hooks.onBoundary?.();
    u.onend = () => resolve();
    u.onerror = () => resolve();
    speechSynthesis.speak(u);
  });
}

export function stopSpeaking() {
  if (speechOutputSupported()) speechSynthesis.cancel();
}
