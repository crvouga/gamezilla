/**
 * Process-wide Postgres + Mockingbird S3 + EMQX for `openHarness` mode `real`, registered
 * with the harness harness by `real-stack-preload.ts` (`test:max` preloads it into
 * every package's spec run). Default `test:spec` never calls this.
 */

import {
  EMQX_API_KEY,
  EMQX_API_SECRET,
  EMQX_DASHBOARD_PORT,
  EMQX_JWT_SECRET,
  EMQX_WS_PORT,
} from '@pkgs/emqx-shared/ports';
import { LOCAL_DATABASE_URL } from '@pkgs/postgres-local-shared/ports';
import type { LocalStackHandle } from '../../server/scripts/boot-local-stack';
import { bootLocalStack } from '../../server/scripts/boot-local-stack';

let started: Promise<void> | undefined;
let active: LocalStackHandle | undefined;

function applyEnv(s3: Readonly<Record<string, string>>): void {
  process.env['DATABASE_URL'] = LOCAL_DATABASE_URL;
  process.env['HARNESS_API_DATABASE_URL'] = LOCAL_DATABASE_URL;
  for (const [name, value] of Object.entries(s3)) process.env[name] = value;
  process.env['EMQX_JWT_SECRET'] = EMQX_JWT_SECRET;
  process.env['EMQX_API_KEY'] = EMQX_API_KEY;
  process.env['EMQX_API_SECRET'] = EMQX_API_SECRET;
  process.env['EMQX_WS_PORT'] = String(EMQX_WS_PORT);
  process.env['EMQX_DASHBOARD_PORT'] = String(EMQX_DASHBOARD_PORT);
}

/** Boot sidecars once per test process; the preload owns their teardown. */
export function ensureMaxFidelityStack(): Promise<void> {
  started ??= (async () => {
    const stack = await bootLocalStack();
    active = stack;
    applyEnv(stack.s3);
  })();
  return started;
}

export async function stopMaxFidelityStack(): Promise<void> {
  await started;
  await active?.stop();
  active = undefined;
  started = undefined;
}
