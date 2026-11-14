import { markSyntheticDevice } from '@libs/auth-shared-ts/synthetic-device';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

export type SyntheticDevicePorts = {
  readonly http: HttpClient;
  readonly apiOrigin: string;
  /** The runner's synthetic-monitor credential; it never reaches the page. */
  readonly token: string;
  /** Evaluate a script in the device's page. */
  readonly evaluate: (script: string) => Promise<unknown>;
  readonly now: () => number;
  readonly sleep: (ms: number) => Promise<void>;
  readonly timeoutMs: number;
};

const READ_DEVICE_ID = `localStorage.getItem('deviceId')`;
const POLL_MS = 250;

/**
 * Mark the anonymous account of the open device synthetic. The app binds its
 * install to an account in the background after the first paint, so wait for
 * that binding; a device left unmarked fails here, before it publishes.
 */
export async function markLiveDeviceSynthetic(
  ports: SyntheticDevicePorts
): Promise<void> {
  const deadline = ports.now() + ports.timeoutMs;
  for (;;) {
    const deviceId = await ports.evaluate(READ_DEVICE_ID);
    if (typeof deviceId === 'string' && deviceId.length > 0) {
      const outcome = await markSyntheticDevice({
        http: ports.http,
        apiOrigin: ports.apiOrigin,
        token: ports.token,
        deviceId,
      });
      if (outcome === 'marked') return;
    }
    if (ports.now() >= deadline)
      throw new Error(
        `the device's anonymous account was not bound within ${String(ports.timeoutMs)} ms, so it cannot be marked synthetic`
      );
    await ports.sleep(POLL_MS);
  }
}
