import type { BetterAuthSessionApi } from '../auth/better-auth/session-claims-port';
import type { HttpBearerAuthPorts } from '../auth/ports';
import type { SessionAuth } from '../auth/session-middleware';
import type { ApiWorkerEnv } from '../config/env';
import type { PatchDb } from '@gamezilla/patch-db/interface';

/** Better Auth instance mounted on Hono (`handler` + {@link BetterAuthSessionApi}). */
export type HostedBetterAuth = BetterAuthSessionApi & {
  handler: (request: Request) => Promise<Response>;
};

/**
 * Hono `Bindings` + `Variables` for the API Worker (Hyperdrive-per-request DB + auth).
 */
export type ApiHonoEnv = {
  Bindings: ApiWorkerEnv;
  Variables: {
    patchDb: PatchDb;
    sessionAuth: SessionAuth;
    betterAuth: HostedBetterAuth;
    bearerAuth: HttpBearerAuthPorts;
  };
};
