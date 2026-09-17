/**
 * Process-wide Postgres + S3rver + EMQX for `openSim` mode `real`.
 * Default `test` never calls this.
 */
import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PORT,
  EMQX_JWT_SECRET,
  EMQX_WS_PORT,
} from '@pkgs/emqx-server';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-embedded/ports';

import { bootLocalStack } from '../../../../../tools/scripts/boot-local-stack';

let started: Promise<void> | undefined;

function applyEnv(s3: Readonly<Record<string, string>>): void {
  process.env['DATABASE_URL'] = LOCAL_DATABASE_URL;
  process.env['SIM_API_DATABASE_URL'] = LOCAL_DATABASE_URL;
  for (const [name, value] of Object.entries(s3)) process.env[name] = value;
  process.env['EMQX_JWT_SECRET'] = EMQX_JWT_SECRET;
  process.env['EMQX_API_KEY'] = EMQX_API_KEY;
  process.env['EMQX_API_SECRET'] = EMQX_API_SECRET;
  process.env['EMQX_WS_PORT'] = String(EMQX_WS_PORT);
  process.env['EMQX_DASHBOARD_PORT'] = String(EMQX_DASHBOARD_PORT);
}

/** Boot sidecars once per Jest/Bun process. Does not stop them (CI job teardown). */
export function ensureMaxFidelityStack(): Promise<void> {
  started ??= (async () => {
    const stack = await bootLocalStack();
    applyEnv(stack.s3);
  })();
  return started;
}
