import { killListenersOnPort } from '@pkgs/os/kill-port';

import { DEV_IDP_DEFAULT_PORT } from './config';

function readPortFromEnv(): number {
  const raw = process.env['DEV_IDP_PORT']?.trim();
  if (raw === undefined || raw === '') return DEV_IDP_DEFAULT_PORT;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= 65_535
    ? n
    : DEV_IDP_DEFAULT_PORT;
}

killListenersOnPort(readPortFromEnv());
