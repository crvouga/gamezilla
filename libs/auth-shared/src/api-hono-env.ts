import type { AuthServerPort } from '@pkgs/auth-shared/auth-server-port';
import type { SqlClient } from '@pkgs/sql-client-shared/interface';

import type { ApiWorkerBindings } from './api-worker-bindings';
import type { SessionAuth } from './session-middleware';

/**
 * Hono `Bindings` + `Variables` for the API Worker (Neon-per-request DB + auth).
 */
export type ApiHonoEnv<_TAuthContext = unknown> = {
  Bindings: ApiWorkerBindings;
  Variables: {
    sqlClient: SqlClient;
    sessionAuth: SessionAuth;
    authServer: AuthServerPort;
  };
};
