/** @jsxImportSource solid-js */
/**
 * Solid bindings for `@pkgs/sounds`: audio playback port context, per-player
 * status signals, the persisted sounds preference, and the `SoundEngine`
 * provider. Ports are always injected (web adapter at the composition root,
 * in-memory port in harnesses) — there is no lazy wall default.
 */
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { createKvState } from '@pkgs/kv-root-client/solid';
import {
  booleanKvCodec,
  jsonKvCodec,
} from '@pkgs/kv-root-shared/kv-state-codec';
import { defineContext } from '@pkgs/solid-context-client/define-context';
import { createSubscriptionSignal } from '@pkgs/solid-context-client/subscription-signal';
import type {
  PlayableAudioPlayer,
  PlayFromStartHandle,
} from '@pkgs/sounds-shared/play-from-start';
import { createPlayFromStart } from '@pkgs/sounds-shared/play-from-start';
import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
  AudioPlayerStatus,
} from '@pkgs/sounds-shared/ports';
import type {
  PlaySoundOptions,
  SoundEngine,
} from '@pkgs/sounds-shared/sound-engine';
import { createSoundEngine } from '@pkgs/sounds-shared/sound-engine';
import type { SoundId } from '@pkgs/sounds-shared/sound-id';
import { Sounds } from '@pkgs/sounds-shared/sound-id';
import {
  type Accessor,
  createMemo,
  type JSX,
  onCleanup,
  type ParentProps,
} from 'solid-js';

// ---------------------------------------------------------------------------
// Audio playback port
// ---------------------------------------------------------------------------

const AudioPlaybackContext = defineContext<AudioPlaybackPort>('AudioPlayback');

export type AudioPlaybackProviderProps = ParentProps<{
  readonly value: AudioPlaybackPort;
}>;

export const AudioPlaybackProvider: (
  props: AudioPlaybackProviderProps
) => JSX.Element = AudioPlaybackContext.Provider;

export function useAudioPlaybackPort(): AudioPlaybackPort {
  return AudioPlaybackContext.use();
}

/** Creates a player for `source`, removed when the owning scope disposes. */
export function createAudioPlayer(source?: unknown): AudioPlayerHandle {
  const port = useAudioPlaybackPort();
  const player = port.createPlayer(source);
  onCleanup(() => {
    try {
      player.remove();
    } catch {
      // Released player races.
    }
  });
  return player;
}

/** Reactive {@link AudioPlayerStatus} for `player`. */
export function createAudioPlayerStatus(
  player: AudioPlayerHandle
): Accessor<AudioPlayerStatus> {
  const port = useAudioPlaybackPort();
  return createSubscriptionSignal({
    getSnapshot: () => port.getStatus(player),
    subscribe: (listener) => port.subscribeStatus(player, () => listener()),
  });
}

// ---------------------------------------------------------------------------
// Play-from-start handles (board sounds)
// ---------------------------------------------------------------------------

async function warmPlayer(player: PlayableAudioPlayer): Promise<void> {
  try {
    await player.seekTo(0);
    player.pause?.();
  } catch {
    // Ignore warmup failures; normal playback path still works.
  }
}

/** Warm players once; cancel in-flight plays when the scope disposes. */
export function warmAudioPlayers(
  players: readonly PlayableAudioPlayer[],
  handles: readonly PlayFromStartHandle[]
): void {
  const state = { cancelled: false };
  void (async () => {
    for (const player of players) {
      if (state.cancelled) return;
      await warmPlayer(player);
    }
  })();
  onCleanup(() => {
    state.cancelled = true;
    for (const handle of handles) handle.cancel();
  });
}

/** One {@link PlayFromStartHandle} per key over the given players. */
export function createPlayFromStartHandles<K extends string>(
  players: Readonly<Record<K, PlayableAudioPlayer>>
): Readonly<Record<K, PlayFromStartHandle>> {
  const handles = {} as Record<K, PlayFromStartHandle>;
  for (const key of Object.keys(players) as K[]) {
    handles[key] = createPlayFromStart(() => players[key]);
  }
  return handles;
}

// ---------------------------------------------------------------------------
// Sounds preference (persisted via Kv)
// ---------------------------------------------------------------------------

const SOUNDS_MUTED_ROW_KEY = asKeyword('ui.prefs/sounds-muted');
const SOUNDS_VALUE_ATTR = asKeyword('ui.prefs/value');
const SOUNDS_MUTED_CODEC = booleanKvCodec(SOUNDS_VALUE_ATTR);

const SOUNDS_VOLUME_ROW_KEY = asKeyword('ui.prefs/sounds-master-volume');
const SOUNDS_VOLUME_CODEC = jsonKvCodec<number>(
  SOUNDS_VALUE_ATTR,
  (value): value is number =>
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1
);

export type SoundsPreference = {
  readonly muted: Accessor<boolean>;
  readonly masterVolume: Accessor<number>;
  readonly setMuted: (next: boolean | ((prev: boolean) => boolean)) => void;
  readonly setMasterVolume: (next: number | ((prev: number) => number)) => void;
};

const SoundsPreferenceContext =
  defineContext<SoundsPreference>('SoundsPreference');

export function SoundsPreferenceProvider(props: ParentProps): JSX.Element {
  const [muted, setMuted] = createKvState<boolean>({
    key: SOUNDS_MUTED_ROW_KEY,
    default: false,
    codec: SOUNDS_MUTED_CODEC,
  });
  const [masterVolume, setMasterVolume] = createKvState<number>({
    key: SOUNDS_VOLUME_ROW_KEY,
    default: 1,
    codec: SOUNDS_VOLUME_CODEC,
  });
  const value: SoundsPreference = {
    muted,
    masterVolume,
    setMuted,
    setMasterVolume,
  };
  return (
    <SoundsPreferenceContext.Provider value={value}>
      {props.children}
    </SoundsPreferenceContext.Provider>
  );
}

export function useSoundsPreference(): SoundsPreference {
  return SoundsPreferenceContext.use();
}

// ---------------------------------------------------------------------------
// Sound engine
// ---------------------------------------------------------------------------

const SoundEngineContext = defineContext<Accessor<SoundEngine>>('SoundEngine');

/**
 * Builds a {@link SoundEngine} from the preference + audio port. The engine is
 * rebuilt (and the previous one disposed) whenever mute / volume change.
 */
export function SoundEngineProvider(props: ParentProps): JSX.Element {
  const prefs = useSoundsPreference();
  const audio = useAudioPlaybackPort();
  const engine = createMemo<SoundEngine>((prev) => {
    prev?.dispose();
    return createSoundEngine({
      muted: prefs.muted(),
      masterVolume: prefs.masterVolume(),
      audio,
    });
  });
  onCleanup(() => engine().dispose());
  return (
    <SoundEngineContext.Provider value={engine}>
      {props.children}
    </SoundEngineContext.Provider>
  );
}

export type SoundEngineApi = {
  readonly play: (id: SoundId, options?: PlaySoundOptions) => void;
  readonly Sounds: typeof Sounds;
};

export function useSoundEngine(): SoundEngineApi {
  const engine = SoundEngineContext.use();
  return {
    play: (id, options) => engine().play(id, options),
    Sounds,
  };
}

export function useOptionalSoundEngine(): Accessor<SoundEngine> | undefined {
  return SoundEngineContext.useOptional();
}

export function useSound(id: SoundId): {
  readonly play: (options?: PlaySoundOptions) => void;
} {
  const { play } = useSoundEngine();
  return { play: (options) => play(id, options) };
}
