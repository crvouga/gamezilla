/**
 * Automated monitoring (the live Health and Release journeys) proves it drives
 * an anonymous device by presenting the deployment's synthetic-monitor
 * credential, a secret only the runner holds and never a browser. The
 * device's anonymous account is then marked synthetic, so its writes carry
 * synthetic provenance on replay (`MutationEnv.synthetic`), exactly as a
 * synthetic-monitor sign-in's do. A person cannot mark their own account.
 */

import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

/** `POST <api>/api/identity/anon/synthetic` with {@link ANON_ID_HEADER}. */
export const SYNTHETIC_DEVICE_PATH = '/identity/anon/synthetic';
/**
 * Carries the monitor credential. Not `Authorization`, so the session
 * middleware never reads it as a (failing) session token.
 */
export const SYNTHETIC_MONITOR_TOKEN_HEADER = 'x-synthetic-monitor-token';

export type MarkSyntheticDeviceArgs = {
  readonly http: HttpClient;
  /** API origin, e.g. `https://api.example.com`. */
  readonly apiOrigin: string;
  readonly token: string;
  readonly deviceId: string;
};

/**
 * `marked` once the device's anonymous account carries synthetic provenance;
 * `unbound` while the device has no anonymous account yet (ask again).
 */
export async function markSyntheticDevice(
  args: MarkSyntheticDeviceArgs
): Promise<'marked' | 'unbound'> {
  const origin = args.apiOrigin.replace(/\/$/, '');
  const res = await args.http.fetch(`${origin}/api${SYNTHETIC_DEVICE_PATH}`, {
    method: 'POST',
    headers: {
      [SYNTHETIC_MONITOR_TOKEN_HEADER]: args.token,
      'x-anon-id': args.deviceId,
    },
  });
  if (res.status === 409) return 'unbound';
  if (!res.ok)
    throw new Error(
      `marking the device synthetic was refused: HTTP ${String(res.status)}`
    );
  return 'marked';
}
