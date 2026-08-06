import { playAudioOrIgnoreAutoplayBlock } from './safe-audio-play';
import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { Platform } from 'react-native';

import { getManifestVolume } from './manifest';
import { soundAssetSources, type SoundAssetSourceId } from './sound-sources';
import type { SoundId } from './sound-id';

export type SoundEngineOptions = {
  readonly muted?: boolean;
  readonly masterVolume?: number;
  readonly respectReducedMotion?: boolean;
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

type WarmablePlayer = {
  seekTo: (seconds: number) => Promise<void>;
  pause?: () => void;
};

async function warmPlayer(player: WarmablePlayer): Promise<void> {
  try {
    await player.seekTo(0);
    player.pause?.();
  } catch {
    // Warmup is best-effort.
  }
}

async function playFromStart(player: AudioPlayer): Promise<void> {
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
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
  return false;
}

export type SoundEngine = {
  readonly play: (id: SoundId, options?: PlaySoundOptions) => void;
  readonly warm: (ids?: readonly SoundId[]) => void;
  readonly dispose: () => void;
};

export function createSoundEngine(
  options: SoundEngineOptions = {}
): SoundEngine {
  const muted = options.muted ?? false;
  const masterVolume = options.masterVolume ?? 1;
  const respectReducedMotion = options.respectReducedMotion ?? true;
  const players = new Map<SoundId, AudioPlayer>();

  function getPlayer(id: SoundId): AudioPlayer {
    const existing = players.get(id);
    if (existing) return existing;
    const source = soundAssetSources[id as SoundAssetSourceId];
    const player = createAudioPlayer(source);
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
