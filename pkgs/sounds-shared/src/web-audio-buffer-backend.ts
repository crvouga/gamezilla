/**
 * Plays one decoded sound through the Web Audio API.
 *
 * Why not a media element: starting a second `HTMLMediaElement` while another
 * is starting blocks the page's main thread in WebKit — 60 to 520 ms measured
 * for two effects played back to back (a wrong puzzle move plays a move sound
 * and a refusal sound), which froze the board on every drop. A buffer source
 * starts in well under a millisecond and any number may overlap.
 *
 * The engine is injected, so this file touches no browser global: the port
 * builds the real one and tests pass a fake.
 */
import type { AudioPlayerStatus } from './ports';

/**
 * A sound asked for this long ago is no longer worth starting. Covers a
 * context that only resumes on a later gesture and a slow first download, so
 * a late effect never plays out of nowhere.
 */
export const START_WINDOW_MS = 400;

export type AudioBufferLike = { readonly duration: number };

export type AudioSourceNodeLike = {
  buffer: AudioBufferLike | null;
  onended: (() => void) | null;
  connect(destination: unknown): unknown;
  disconnect(): void;
  start(when?: number, offset?: number): void;
  stop(): void;
};

export type AudioGainNodeLike = {
  readonly gain: { value: number };
  connect(destination: unknown): unknown;
  disconnect(): void;
};

/** The part of `AudioContext` a buffer backend uses. */
export type AudioContextLike = {
  readonly state: string;
  readonly currentTime: number;
  readonly destination: unknown;
  resume(): Promise<void>;
  createBufferSource(): AudioSourceNodeLike;
  createGain(): AudioGainNodeLike;
  decodeAudioData(
    data: ArrayBuffer,
    onDecoded: (buffer: AudioBufferLike) => void,
    onError: (error: unknown) => void
  ): unknown;
};

export type BufferAudioEngine = {
  readonly context: AudioContextLike;
  /** The encoded bytes of the sound at `url`. */
  readonly load: (url: string) => Promise<ArrayBuffer>;
  /** Milliseconds on any steady clock. */
  readonly now: () => number;
};

/** What a player's backend does for it, whichever way it makes sound. */
export type PlayerBackend = {
  play(): void | Promise<void>;
  pause(): void;
  seekTo(seconds: number): void;
  setVolume(value: number): void;
  status(): Omit<AudioPlayerStatus, 'didJustFinish'>;
  dispose(): void;
};

export type PlayerBackendEvents = {
  /** Loaded, started, paused or moved. */
  readonly changed: () => void;
  /** Played to its end. */
  readonly ended: () => void;
};

function decode(
  context: AudioContextLike,
  data: ArrayBuffer
): Promise<AudioBufferLike> {
  // The callback form: older WebKit has no promise-returning decode.
  return new Promise((resolve, reject) => {
    context.decodeAudioData(data, resolve, reject);
  });
}

type Playback = { readonly source: AudioSourceNodeLike; startedAt: number };

/** One sound's playhead: what is loaded, what is sounding, where it resumes. */
type Playhead = {
  readonly engine: BufferAudioEngine;
  readonly gain: AudioGainNodeLike;
  readonly events: PlayerBackendEvents;
  buffer: AudioBufferLike | null;
  playback: Playback | null;
  /** Where playback starts next, in seconds. */
  offset: number;
  /** When `play` was last asked for and has not started yet. */
  wantedAt: number | null;
  disposed: boolean;
};

function stop(head: Playhead): void {
  const current = head.playback;
  if (current === null) return;
  head.playback = null;
  current.source.onended = null;
  try {
    current.source.stop();
  } catch {
    // A source that never started cannot be stopped.
  }
  current.source.disconnect();
}

function begin(head: Playhead, decoded: AudioBufferLike): void {
  const context = head.engine.context;
  stop(head);
  if (head.offset >= decoded.duration) head.offset = 0;
  const source = context.createBufferSource();
  source.buffer = decoded;
  source.connect(head.gain);
  source.onended = () => {
    if (head.playback?.source !== source) return;
    head.playback = null;
    head.offset = decoded.duration;
    source.disconnect();
    head.events.ended();
  };
  head.playback = { source, startedAt: context.currentTime };
  source.start(0, head.offset);
  head.events.changed();
}

function startIfWanted(head: Playhead): void {
  if (head.wantedAt === null || head.buffer === null || head.disposed) return;
  if (head.engine.context.state !== 'running') return;
  const stale = head.engine.now() - head.wantedAt > START_WINDOW_MS;
  head.wantedAt = null;
  if (!stale) begin(head, head.buffer);
}

function load(head: Playhead, url: string): void {
  void head.engine
    .load(url)
    .then((data) => decode(head.engine.context, data))
    .then((decoded) => {
      if (head.disposed) return;
      head.buffer = decoded;
      head.events.changed();
      startIfWanted(head);
    })
    // An effect that cannot be fetched or decoded stays silent.
    .catch(() => undefined);
}

function elapsed(head: Playhead): number {
  return head.playback === null
    ? 0
    : head.engine.context.currentTime - head.playback.startedAt;
}

export function createBufferBackend(args: {
  readonly engine: BufferAudioEngine;
  readonly url: string;
  readonly volume: number;
  readonly events: PlayerBackendEvents;
}): PlayerBackend {
  const context = args.engine.context;
  const gain = context.createGain();
  gain.gain.value = args.volume;
  gain.connect(context.destination);
  const head: Playhead = {
    engine: args.engine,
    gain,
    events: args.events,
    buffer: null,
    playback: null,
    offset: 0,
    wantedAt: null,
    disposed: false,
  };
  load(head, args.url);
  return {
    play() {
      head.wantedAt = args.engine.now();
      if (context.state === 'running') {
        startIfWanted(head);
        return;
      }
      // Suspended until the person's first gesture; `resume` inside one
      // starts the context, and the sound with it.
      return context.resume().then(
        () => startIfWanted(head),
        () => undefined
      );
    },
    pause() {
      head.wantedAt = null;
      if (head.playback === null) return;
      head.offset += elapsed(head);
      stop(head);
      args.events.changed();
    },
    seekTo(seconds) {
      head.offset = Math.max(0, seconds);
      if (head.playback !== null && head.buffer !== null) {
        begin(head, head.buffer);
      } else args.events.changed();
    },
    setVolume(value) {
      gain.gain.value = value;
    },
    status: () => ({
      playing: head.playback !== null,
      isLoaded: head.buffer !== null,
      duration: head.buffer?.duration ?? 0,
      currentTime: head.offset + elapsed(head),
    }),
    dispose() {
      head.disposed = true;
      head.wantedAt = null;
      stop(head);
      gain.disconnect();
    },
  };
}
