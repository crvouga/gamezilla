import type { ClientEnv } from '@libs/client-app/shell/client-env';
import {
  TEST_DEVICE_PORTS_GLOBAL,
  type TestDevicePorts,
} from '@libs/client-app/shell/test-device-ports';
import type { MutableMotionPreferencePort } from '@pkgs/device/motion-preference';
import type { RecordingAudioPlaybackPort } from '@pkgs/sounds/audio-playback/recording-audio-playback-port';
import type { HarnessDevice } from '../system/harness';

/** Direct probes of injected devices, never the app's playback indicator. */
export function inProcessDevice(
  env: Pick<ClientEnv, 'audio' | 'motion'>
): HarnessDevice {
  const audio = env.audio as RecordingAudioPlaybackPort;
  const motion = env.motion as MutableMotionPreferencePort;
  return {
    audioState: () =>
      Promise.resolve(
        audio.players().map((player) => ({
          source: audio.getSource(player),
          status: audio.getStatus(player),
        }))
      ),
    audioFailures: () => Promise.resolve(audio.failures()),
    failAudio: () => {
      audio.failNextMatching((source) => source === undefined);
      return Promise.resolve();
    },
    setReducedMotion: (reduced) => {
      motion.setReduced(reduced);
      return Promise.resolve();
    },
  };
}

/** The live page exposes its actual injected device ports in test builds. */
export function webviewDevice(view: {
  evaluate(script: string): Promise<unknown>;
}): HarnessDevice {
  async function call<M extends keyof TestDevicePorts>(
    method: M,
    arg?: boolean
  ): Promise<ReturnType<TestDevicePorts[M]>> {
    const hook = `globalThis[${JSON.stringify(TEST_DEVICE_PORTS_GLOBAL)}]`;
    const script = `JSON.stringify(${hook}.${method}(${arg === undefined ? '' : String(arg)}))`;
    const raw = await view.evaluate(script);
    return (
      typeof raw === 'string' ? JSON.parse(raw) : undefined
    ) as ReturnType<TestDevicePorts[M]>;
  }
  return {
    audioState: () => call('audioState'),
    audioFailures: () => call('audioFailures'),
    failAudio: () => call('failAudio'),
    setReducedMotion: (reduced) => call('setReducedMotion', reduced),
  };
}
