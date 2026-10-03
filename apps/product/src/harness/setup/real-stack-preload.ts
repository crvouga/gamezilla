// @io-wall-ok — bun:test preload for live-browser runs of every spec suite.
/**
 * `HARNESS_MODE=real` needs embedded Postgres + Mockingbird S3 + EMQX, which only the
 * product may boot (it imports `@apps/server`). `test:max` passes this file as
 * `HARNESS_PRELOAD`, so every package's `test:spec` registers the booter with the
 * harness without the harness naming an app.
 */

import { registerRealStackBooter } from '@libs/harness/hosts/real-stack';

import { ensureMaxFidelityStack } from './real-mode-stack';

registerRealStackBooter(ensureMaxFidelityStack);
