import type { PatchDb } from '@pkgs/patch-db/interface';

import type { ApiWorkerBindings } from './api-worker-bindings';
import type { HostedBetterAuth } from './better-auth-create';
import type { SessionAuth } from './session-middleware';

export type { HostedBetterAuth } from './better-auth-create';

/**
 * Hono `Bindings` + `Variables` for the API Worker (Neon-per-request DB + auth).
 *
 * `TAuthContext` is unused now that `sessionAuth` resolves directly to the
 * concrete `AuthContext`, but kept as a phantom parameter so existing
 * `Hono<ApiHonoEnv<AuthContext>>` annotations stay valid during the cleanup.
 */
export type ApiHonoEnv<_TAuthContext = unknown> = {
  Bindings: ApiWorkerBindings;
  Variables: {
    patchDb: PatchDb;
    sessionAuth: SessionAuth;
    betterAuth: HostedBetterAuth;
  };
};
