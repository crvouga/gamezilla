import {
  controllableWebMotionPreference,
  wallWebMotionPreference,
} from '@pkgs/device-client-ts/wall-web-motion-preference';
import type { MutableMotionPreferencePort } from '@pkgs/device-shared-ts/motion-preference';
import type {
  AudioPlaybackPort,
  AudioPlayerStatus,
} from '@pkgs/sounds-shared-ts/ports';
import { recordAudioPlayback } from '@pkgs/sounds-shared-ts/recording-audio-playback-port';

export const TEST_DEVICE_PORTS_GLOBAL = '__testDevicePorts';

export type TestDevicePorts = {
  readonly audioState: () => readonly {
    source: unknown;
    status: AudioPlayerStatus;
  }[];
  readonly audioFailures: () => number;
  readonly failAudio: () => void;
  readonly setReducedMotion: (reduced: boolean) => void;
};

/** Test builds expose injected device boundaries, as they expose local SQL. */
export function webDevicePorts(audio: AudioPlaybackPort) {
  const env = import.meta.env as { VITE_TEST_HOOKS?: string };
  if (env.VITE_TEST_HOOKS !== '1')
    return { audio, motion: wallWebMotionPreference() };
  const recording = recordAudioPlayback(audio);
  const motion: MutableMotionPreferencePort = controllableWebMotionPreference();
  const hook: TestDevicePorts = {
    audioState: () =>
      recording.players().map((player) => ({
        source: recording.getSource(player),
        status: recording.getStatus(player),
      })),
    audioFailures: recording.failures,
    failAudio: () =>
      recording.failNextMatching((source) => source === undefined),
    setReducedMotion: motion.setReduced,
  };
  Reflect.set(globalThis, TEST_DEVICE_PORTS_GLOBAL, hook);
  return { audio: recording, motion };
}
