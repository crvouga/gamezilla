// @io-wall-ok — bun:test preload for live-browser runs of every e2e suite.
/**
 * `SIM_MODE=real` needs embedded Postgres + S3rver + EMQX, which only the
 * product may boot (it imports `@apps/server`). `test:max` passes this file as
 * `SIM_PRELOAD`, so every package's `test:e2e` registers the booter with the
 * harness without the harness naming an app.
 */

import { registerRealStackBooter } from '@libs/sim-harness/hosts/real-stack';

import { ensureMaxFidelityStack } from './real-mode-stack';

registerRealStackBooter(ensureMaxFidelityStack);
