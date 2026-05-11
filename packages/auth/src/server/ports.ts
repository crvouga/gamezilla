/**
 * Auth ports. The pure interfaces live in `@gamezilla/api-types/auth-ports`
 * so feature packages (and the api composition root) can depend on them
 * without taking on the auth package.
 *
 * `AuthSessionPort` is re-exported here in its specialized form (bound to
 * the auth-local {@link AuthContext}) so existing imports inside auth keep
 * working with the same type.
 */
import type { AuthSessionPort as GenericAuthSessionPort } from '@gamezilla/api-types/auth-ports';

import type { AuthContext } from './types';

export type {
  AccountProvisioningPort,
  BetterAuthSessionApi,
  HttpBearerAuthPorts,
  SessionClaims,
  SessionClaimsPort,
} from '@gamezilla/api-types/auth-ports';

/** Auth-bound specialization — `requireAuthContext` resolves to {@link AuthContext}. */
export type AuthSessionPort = GenericAuthSessionPort<AuthContext>;
