import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from '@libs/client-config/shared/local-preview-api-origin';
import { killListenersOnPorts } from '@pkgs/os/kill-port';

import {
  QA_DEV_IDP_PORT,
  QA_PREVIEW_PORT,
} from '../constants/qa-preview-ports';

/**
 * Frees dedicated QA preview ports before Playwright starts `turbo preview`.
 * `reuseExistingServer` only skips boot when `/ready` is 2xx; a stale client on
 * :5175 still holds the port and returns 503, so the new stack cannot bind.
 */
export function ensureQaPreviewPortsFree(): void {
  if (process.env['CI']) return;

  const apiPort = Number(new URL(DEFAULT_LOCAL_PREVIEW_API_ORIGIN).port);
  killListenersOnPorts([QA_PREVIEW_PORT, QA_DEV_IDP_PORT, apiPort]);
}
