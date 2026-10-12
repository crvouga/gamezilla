// @io-wall-ok — browser audio wall adapter (entry-shaped).
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from './ports';
import type {
  AudioContextLike,
  BufferAudioEngine,
  PlayerBackend,
  PlayerBackendEvents,
} from './web-audio-buffer-backend';
import { createBufferBackend } from './web-audio-buffer-backend';

type StatusListener = (status: AudioPlayerStatus) => void;

type WebPlayer = AudioPlayerHandle & {
  readonly __status: () => AudioPlayerStatus;
  readonly __listeners: Set<StatusListener>;
};

/**
 * Coerce the sources the app passes around (Vite asset URL strings,
 * `{ uri }` records, `URL` objects) into a URL string.
 */
export function resolveWebAudioSource(source: unknown): string | null {
  if (typeof source === 'string') return source;
  if (source instanceof URL) return source.href;
  if (
    source !== null &&
    typeof source === 'object' &&
    'uri' in source &&
    typeof source.uri === 'string'
  ) {
    return source.uri;
  }
  return null;
}

/**
 * A clip the app made itself (`blob:` / `data:`), which is speech. One plays
 * at a time and the same element keeps the permission its first gesture
 * earned, so it stays on a media element. Everything else is an effect.
 */
function isOwnClip(url: string): boolean {
  return /^(blob:|data:)/i.test(url);
}

const STATUS_EVENTS = [
  'loadedmetadata',
  'canplay',
  'play',
  'playing',
  'pause',
  'timeupdate',
  'seeked',
  'durationchange',
  'emptied',
] as const;

type ElementBackend = PlayerBackend & {
  /** Point the same element at another clip, or at nothing. */
  replace(url: string | null): void;
};

function createElementBackend(
  url: string | null,
  volume: number,
  events: PlayerBackendEvents
): ElementBackend {
  const el = new Audio();
  el.preload = 'auto';
  el.volume = volume;
  if (url !== null) el.src = url;
  for (const event of STATUS_EVENTS) {
    el.addEventListener(event, events.changed);
  }
  el.addEventListener('ended', events.ended);
  return {
    // Returned promise is surfaced so callers can ignore autoplay blocks.
    play: () => el.play(),
    pause: () => el.pause(),
    seekTo(seconds) {
      el.currentTime = seconds;
    },
    setVolume(value) {
      el.volume = value;
    },
    status: () => ({
      playing: !el.paused && !el.ended,
      isLoaded: el.readyState >= HTMLMediaElement.HAVE_METADATA,
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      currentTime: el.currentTime,
    }),
    replace(next) {
      if (next === null) el.removeAttribute('src');
      else el.src = next;
      el.load();
    },
    dispose() {
      el.pause();
      el.removeAttribute('src');
      el.load();
    },
  };
}

function createWebPlayer(
  engine: () => BufferAudioEngine | null,
  source: unknown
): WebPlayer {
  const listeners = new Set<StatusListener>();
  let didJustFinish = false;
  let volume = 1;
  let element: ElementBackend | null = null;

  const status = (): AudioPlayerStatus => ({
    ...backend.status(),
    didJustFinish,
  });
  const emit = (): void => {
    const current = status();
    for (const listener of [...listeners]) listener(current);
  };
  const events: PlayerBackendEvents = {
    changed: emit,
    ended() {
      didJustFinish = true;
      emit();
      didJustFinish = false;
    },
  };

  /** The backend for `next`: effects overlap freely, speech keeps its element. */
  const open = (next: unknown): PlayerBackend => {
    const url = resolveWebAudioSource(next);
    const buffers = url === null || isOwnClip(url) ? null : engine();
    if (url !== null && buffers !== null) {
      element = null;
      return createBufferBackend({ engine: buffers, url, volume, events });
    }
    if (element === null) element = createElementBackend(url, volume, events);
    else element.replace(url);
    return element;
  };
  let backend = open(source);

  return {
    get volume() {
      return volume;
    },
    set volume(value: number) {
      volume = Math.min(1, Math.max(0, value));
      backend.setVolume(volume);
    },
    play() {
      didJustFinish = false;
      return backend.play();
    },
    pause() {
      backend.pause();
    },
    seekTo(seconds: number) {
      backend.seekTo(seconds);
      return Promise.resolve();
    },
    replace(next: unknown) {
      didJustFinish = false;
      const previous = backend;
      backend = open(next);
      if (previous === backend) return;
      previous.dispose();
      emit();
    },
    remove() {
      backend.dispose();
      listeners.clear();
    },
    __status: status,
    __listeners: listeners,
  };
}

type AudioContextCtor = new () => unknown;

/** The page's own Web Audio context; null where the API does not exist. */
function createPageContext(): AudioContextLike | null {
  const scope = globalThis as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  const Ctor = scope.AudioContext ?? scope.webkitAudioContext;
  // The DOM's node types are wider than the part this adapter uses.
  return Ctor === undefined ? null : (new Ctor() as AudioContextLike);
}

export type WebAudioPlaybackOptions = {
  /** Fetches an effect's bytes. */
  readonly fetch: (url: string) => Promise<Response>;
  /** Milliseconds on a steady clock. */
  readonly now: () => number;
  /** Replaces the page's Web Audio context; null plays everything on elements. */
  readonly context?: AudioContextLike | null;
};

/**
 * Browser {@link AudioPlaybackPort}. Effects are decoded once and played
 * through Web Audio, so starting one never blocks the page and several may
 * overlap; speech clips play on an `HTMLAudioElement`.
 */
export function createWebAudioPlaybackPort(
  options: WebAudioPlaybackOptions
): AudioPlaybackPort {
  // Built on first use: a context made before any gesture only logs a warning.
  let context = options.context;
  const engine = (): BufferAudioEngine | null => {
    if (context === undefined) context = createPageContext();
    if (context === null) return null;
    return {
      context,
      async load(url) {
        const response = await options.fetch(url);
        if (!response.ok) throw new Error(`sound ${url}: ${response.status}`);
        return response.arrayBuffer();
      },
      now: options.now,
    };
  };
  return {
    createPlayer: (source) => createWebPlayer(engine, source),
    getStatus: (player) => (player as WebPlayer).__status(),
    subscribeStatus(player, listener) {
      const listeners = (player as WebPlayer).__listeners;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
