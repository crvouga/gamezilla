import type { PatchDb } from '@gamezilla/patch-db/interface';

import type {
  AuthSessionPort,
  BetterAuthSessionApi,
  HttpBearerAuthPorts,
} from './auth-ports';
import type { ApiWorkerEnv } from './env';

/** Better Auth instance mounted on Hono (`handler` + {@link BetterAuthSessionApi}). */
export type HostedBetterAuth = BetterAuthSessionApi & {
  handler: (request: Request) => Promise<Response>;
};

/**
 * Hono `Bindings` + `Variables` for the API Worker (Hyperdrive-per-request DB + auth).
 *
 * Generic over the concrete auth-context returned by
 * {@link AuthSessionPort.requireAuthContext} so this leaf stays decoupled
 * from the auth package's `AuthContext` type. Auth declares
 * `Hono<ApiHonoEnv<AuthContext>>` at the type boundary; other features that
 * only read other variables use the default `unknown` and never touch
 * `sessionAuth.requireAuthContext`.
 */
export type ApiHonoEnv<TAuthContext = unknown> = {
  Bindings: ApiWorkerEnv;
  Variables: {
    patchDb: PatchDb;
    sessionAuth: AuthSessionPort<TAuthContext>;
    betterAuth: HostedBetterAuth;
    bearerAuth: HttpBearerAuthPorts;
  };
};
