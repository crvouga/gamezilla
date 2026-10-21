import type {
  AudioPlaybackPort,
  AudioPlayerHandle,
} from '@pkgs/sounds-shared-ts/ports';
import type { OfflineNetworkController } from './offline-network-controller';
import { offlineNetworkError } from './offline-network-http';

function localAudioSource(source: unknown): boolean {
  if (source === undefined || source === null) return true;
  const uri =
    source instanceof URL
      ? source.href
      : typeof source === 'object' && 'uri' in source
        ? source.uri
        : source;
  return typeof uri === 'string' && /^(blob:|data:)/i.test(uri);
}

/** Media elements fetch independently of HTTP; detach their remote sources offline. */
export function createOfflineAudioPlayback(
  offline: OfflineNetworkController,
  audio: AudioPlaybackPort
): AudioPlaybackPort {
  const players = new WeakMap<AudioPlayerHandle, AudioPlayerHandle>();
  const unwrap = (player: AudioPlayerHandle): AudioPlayerHandle => {
    const inner = players.get(player);
    if (inner === undefined) throw new Error('Unknown offline audio player');
    return inner;
  };
  return {
    createPlayer(source) {
      let requested = source;
      let removed = false;
      const allowed = (): boolean =>
        !offline.isOffline() || localAudioSource(requested);
      const inner = audio.createPlayer(allowed() ? requested : undefined);
      const stopOffline = offline.subscribe(() => {
        if (!localAudioSource(requested)) {
          inner.pause();
          inner.replace(allowed() ? requested : undefined);
        }
      });
      const player: AudioPlayerHandle = {
        get volume() {
          return inner.volume;
        },
        set volume(value) {
          inner.volume = value;
        },
        play: () =>
          allowed() ? inner.play() : Promise.reject(offlineNetworkError()),
        pause: () => inner.pause(),
        seekTo: (seconds) => inner.seekTo(seconds),
        replace(next) {
          if (removed) return;
          requested = next;
          inner.replace(allowed() ? next : undefined);
        },
        remove() {
          if (removed) return;
          removed = true;
          stopOffline();
          inner.remove();
        },
      };
      players.set(player, inner);
      return player;
    },
    getStatus: (player) => audio.getStatus(unwrap(player)),
    subscribeStatus: (player, listener) =>
      audio.subscribeStatus(unwrap(player), listener),
    ...(audio.setAudioModeAsync === undefined
      ? {}
      : {
          setAudioModeAsync: (mode: unknown) => audio.setAudioModeAsync!(mode),
        }),
  };
}
