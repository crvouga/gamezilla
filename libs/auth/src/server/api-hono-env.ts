import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { ApiWorkerBindings } from './api-worker-bindings';
import type { SessionAuth } from './session-middleware';

/**
 * Hono `Bindings` + `Variables` for the API Worker (Neon-per-request DB + auth).
 *
 * `betterAuth` is set by the API composition root (provider adapter instance).
 * Typed loosely here so `@libs/auth` stays provider-agnostic.
 */
export type ApiHonoEnv<_TAuthContext = unknown> = {
  Bindings: ApiWorkerBindings;
  Variables: {
    sqlClient: SqlClient;
    sessionAuth: SessionAuth;
    authServer: AuthServerPort;
    betterAuth: unknown;
  };
};
