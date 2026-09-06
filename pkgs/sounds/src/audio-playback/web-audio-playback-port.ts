// @io-wall-ok — browser HTMLAudioElement wall adapter (entry-shaped).
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from './ports';

type StatusListener = (status: AudioPlayerStatus) => void;

type WebPlayer = AudioPlayerHandle & {
  readonly __element: HTMLAudioElement;
  readonly __listeners: Set<StatusListener>;
  __didJustFinish: boolean;
};

/**
 * Coerce the sources the app passes around (Vite asset URL strings,
 * `{ uri }` records, `URL` objects) into an `HTMLAudioElement` `src`.
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

function readStatus(player: WebPlayer): AudioPlayerStatus {
  const el = player.__element;
  const duration = Number.isFinite(el.duration) ? el.duration : 0;
  return {
    playing: !el.paused && !el.ended,
    isLoaded: el.readyState >= HTMLMediaElement.HAVE_METADATA,
    duration,
    currentTime: el.currentTime,
    didJustFinish: player.__didJustFinish,
  };
}

function emit(player: WebPlayer): void {
  const status = readStatus(player);
  for (const listener of [...player.__listeners]) listener(status);
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

function createWebPlayer(source: unknown): WebPlayer {
  const el = new Audio();
  el.preload = 'auto';
  const src = resolveWebAudioSource(source);
  if (src !== null) el.src = src;

  const player: WebPlayer = {
    __element: el,
    __listeners: new Set(),
    __didJustFinish: false,
    get volume() {
      return el.volume;
    },
    set volume(value: number) {
      el.volume = Math.min(1, Math.max(0, value));
    },
    play() {
      player.__didJustFinish = false;
      // Returned promise is surfaced so callers can ignore autoplay blocks.
      return el.play();
    },
    pause() {
      el.pause();
    },
    seekTo(seconds: number) {
      el.currentTime = seconds;
      return Promise.resolve();
    },
    replace(next: unknown) {
      const nextSrc = resolveWebAudioSource(next);
      player.__didJustFinish = false;
      if (nextSrc === null) {
        el.removeAttribute('src');
        el.load();
        return;
      }
      el.src = nextSrc;
      el.load();
    },
    remove() {
      el.pause();
      el.removeAttribute('src');
      el.load();
      player.__listeners.clear();
    },
  };

  for (const event of STATUS_EVENTS) {
    el.addEventListener(event, () => {
      if (event === 'play' || event === 'playing')
        player.__didJustFinish = false;
      emit(player);
    });
  }
  el.addEventListener('ended', () => {
    player.__didJustFinish = true;
    emit(player);
    player.__didJustFinish = false;
  });

  return player;
}

/** Browser {@link AudioPlaybackPort} backed by `HTMLAudioElement`. */
export function createWebAudioPlaybackPort(): AudioPlaybackPort {
  return {
    createPlayer: (source) => createWebPlayer(source),
    getStatus: (player) => readStatus(player as WebPlayer),
    subscribeStatus(player, listener) {
      const p = player as WebPlayer;
      p.__listeners.add(listener);
      return () => {
        p.__listeners.delete(listener);
      };
    },
  };
}
