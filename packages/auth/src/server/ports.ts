/**
 * Auth ports. Concrete interfaces live in `./auth-ports`; this module binds
 * `AuthSessionPort` to the auth-local {@link AuthContext}.
 */
import type { AuthSessionPort as GenericAuthSessionPort } from './auth-ports';

import type { AuthContext } from './types';

export type {
  AccountProvisioningPort,
  BetterAuthSessionApi,
  HttpBearerAuthPorts,
  SessionClaims,
  SessionClaimsPort,
} from './auth-ports';

/** Auth-bound specialization — `requireAuthContext` resolves to {@link AuthContext}. */
export type AuthSessionPort = GenericAuthSessionPort<AuthContext>;
