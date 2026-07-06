import { killListenersOnPorts } from '@pkgs/os/kill-port';

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from './local-api-preview';
import { DEV_CLIENT_PORT, DEV_IDP_PORT } from './local-e2e-stack';

/** Frees dev-stack ports before manually restarting preview (local only). */
export function ensureDevStackPortsFree(): void {
  if (process.env['CI']) return;

  const apiPort = Number(new URL(DEFAULT_LOCAL_PREVIEW_API_ORIGIN).port);
  killListenersOnPorts([DEV_CLIENT_PORT, DEV_IDP_PORT, apiPort]);
}
