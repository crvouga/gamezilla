// @io-wall-ok — bun:test preload for live-browser runs of every spec suite.
/**
 * `HARNESS_MODE=real` needs Mockingbird Postgres + Mockingbird S3 + EMQX, which only the
 * product may boot (it imports `@apps/server`). `test:max` passes this file as
 * `HARNESS_PRELOAD`, so every package's `test:spec` registers the booter with the
 * harness without the harness naming an app.
 */

import { afterAll } from 'bun:test';
import { registerRealStackBooter } from '@libs/harness/real-stack';

import {
  ensureMaxFidelityStack,
  stopMaxFidelityStack,
} from './real-mode-stack';

registerRealStackBooter(ensureMaxFidelityStack);
afterAll(stopMaxFidelityStack);
