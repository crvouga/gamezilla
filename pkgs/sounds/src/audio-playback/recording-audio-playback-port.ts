import type { AudioPlaybackPort, AudioPlayerHandle } from './ports';

export type RecordingAudioPlaybackPort = AudioPlaybackPort & {
  readonly players: () => readonly AudioPlayerHandle[];
  readonly getSource: (player: AudioPlayerHandle) => unknown;
  readonly failNextMatching: (match: (source: unknown) => boolean) => void;
  readonly failures: () => number;
};

/** Records the actual device player; playback still goes through the supplied port. */
export function recordAudioPlayback(
  base: AudioPlaybackPort
): RecordingAudioPlaybackPort {
  const created: AudioPlayerHandle[] = [];
  const underlying = new Map<AudioPlayerHandle, AudioPlayerHandle>();
  const sources = new Map<AudioPlayerHandle, unknown>();
  let failWhen: ((source: unknown) => boolean) | null = null;
  let failures = 0;
  const unwrap = (player: AudioPlayerHandle) => {
    const actual = underlying.get(player);
    if (actual === undefined) throw new Error('Unknown recorded audio player');
    return actual;
  };
  return {
    createPlayer: (source) => {
      if (failWhen?.(source)) {
        failWhen = null;
        failures++;
        throw new Error('Audio device unavailable');
      }
      const actual = base.createPlayer(source);
      const player: AudioPlayerHandle = {
        get volume() {
          return actual.volume;
        },
        set volume(value) {
          actual.volume = value;
        },
        play: () => actual.play(),
        pause: () => actual.pause(),
        seekTo: (seconds) => actual.seekTo(seconds),
        replace: (next) => {
          sources.set(player, next);
          actual.replace(next);
        },
        remove: () => actual.remove(),
      };
      underlying.set(player, actual);
      sources.set(player, source);
      created.push(player);
      return player;
    },
    getStatus: (player) => base.getStatus(unwrap(player)),
    subscribeStatus: (player, listener) =>
      base.subscribeStatus(unwrap(player), listener),
    ...(base.setAudioModeAsync === undefined
      ? {}
      : {
          setAudioModeAsync: (mode: unknown) => base.setAudioModeAsync!(mode),
        }),
    players: () => created,
    getSource: (player) => sources.get(player),
    failNextMatching: (match) => {
      failWhen = match;
    },
    failures: () => failures,
  };
}
