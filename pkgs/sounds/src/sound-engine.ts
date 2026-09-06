import type { AudioPlaybackPort } from './audio-playback/ports';
import { getManifestVolume } from './manifest';
import { playAudioOrIgnoreAutoplayBlock } from './safe-audio-play';
import type { SoundId } from './sound-id';
import { type SoundAssetUrlId, soundAssetUrls } from './sound-urls';

export type SoundEngineOptions = {
  readonly muted?: boolean;
  readonly masterVolume?: number;
  readonly respectReducedMotion?: boolean;
  /** Injected audio port (web / native adapter, or the in-memory sim port). */
  readonly audio: AudioPlaybackPort;
};

export type PlaySoundOptions = {
  readonly volume?: number;
};

const WARM_SOUND_IDS: readonly SoundId[] = [
  'navigation.click',
  'feedback.success',
  'feedback.error',
  'feedback.failure',
  'social.roomJoined',
  'social.roomLeft',
];

type AudioPlayerLike = {
  volume: number;
  seekTo: (seconds: number) => Promise<void>;
  play: () => void;
  pause?: () => void;
  remove: () => void;
};

async function warmPlayer(player: AudioPlayerLike): Promise<void> {
  try {
    await player.seekTo(0);
    player.pause?.();
  } catch {
    // Warmup is best-effort.
  }
}

async function playFromStart(player: AudioPlayerLike): Promise<void> {
  try {
    try {
      await player.seekTo(0);
    } catch {
      // seek can fail before load; still try play
    }
    playAudioOrIgnoreAutoplayBlock(() => player.play());
  } catch {
    // Released SharedObject / dispose races.
  }
}

function isReducedMotionEnabled(): boolean {
  if (
    typeof window === 'undefined' ||
    typeof window.matchMedia !== 'function'
  ) {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export type SoundEngine = {
  readonly play: (id: SoundId, options?: PlaySoundOptions) => void;
  readonly warm: (ids?: readonly SoundId[]) => void;
  readonly dispose: () => void;
};

function createNoopSoundEngine(): SoundEngine {
  return {
    play: () => undefined,
    warm: () => undefined,
    dispose: () => undefined,
  };
}

export function createSoundEngine(options: SoundEngineOptions): SoundEngine {
  const audio = options.audio;
  if (typeof audio.createPlayer !== 'function') {
    return createNoopSoundEngine();
  }

  const muted = options.muted ?? false;
  const masterVolume = options.masterVolume ?? 1;
  const respectReducedMotion = options.respectReducedMotion ?? true;
  const players = new Map<SoundId, AudioPlayerLike>();

  function getPlayer(id: SoundId): AudioPlayerLike {
    const existing = players.get(id);
    if (existing) return existing;
    const source = soundAssetUrls[id as SoundAssetUrlId];
    const player = audio.createPlayer(source);
    players.set(id, player);
    return player;
  }

  function warm(ids: readonly SoundId[] = WARM_SOUND_IDS): void {
    void (async () => {
      for (const id of ids) {
        await warmPlayer(getPlayer(id));
      }
    })();
  }

  function play(id: SoundId, playOptions?: PlaySoundOptions): void {
    if (muted) return;
    if (respectReducedMotion && isReducedMotionEnabled()) return;

    const manifestVolume = getManifestVolume(id);
    const volume = (playOptions?.volume ?? manifestVolume) * masterVolume;
    if (volume <= 0) return;

    const player = getPlayer(id);
    player.volume = volume;
    void playFromStart(player);
  }

  function dispose(): void {
    for (const player of players.values()) {
      player.remove();
    }
    players.clear();
  }

  warm();

  return { play, warm, dispose };
}
