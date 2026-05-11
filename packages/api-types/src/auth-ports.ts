import { assertUuid } from '@gamezilla/lib/uuid';
import type { PatchDb } from '@gamezilla/patch-db/interface';

/** Header carrying the install-scoped device id on HTTP / WebSocket requests. */
export const ANON_ID_HEADER = 'x-anon-id';

/**
 * Provider-agnostic session token claims (OIDC-style `sub` → neutral `subject`).
 */
export type SessionClaims = {
  readonly subject: string;
  readonly email: string | null;
};

/** Verifies an HTTP `Authorization: Bearer` token and returns claims or null. */
export interface SessionClaimsPort {
  verifyBearer(token: string): Promise<SessionClaims | null>;
}

/** Maps external identity claims to the internal PatchDB account UUID. */
export interface AccountProvisioningPort {
  resolveInternalAccountId(args: {
    db: PatchDb;
    claims: SessionClaims;
  }): Promise<string>;
}

/** Combined HTTP bearer auth (verification + account binding). */
export type HttpBearerAuthPorts = {
  readonly sessionClaims: SessionClaimsPort;
  readonly accountProvisioning: AccountProvisioningPort;
};

/**
 * Hono `Variables.sessionAuth` port. Generic over the concrete auth-context
 * type so this leaf does not need to import the app's `AppAuthContext`. Auth
 * declares its concrete `AuthSessionPort<AuthContext>` at the type boundary.
 */
export interface AuthSessionPort<TAuthContext = unknown> {
  resolvePatchDbContext(
    db: PatchDb,
    request: Request
  ): Promise<Readonly<Record<string, unknown>>>;
  requireAuthContext(db: PatchDb, request: Request): Promise<TAuthContext>;
}

/** Narrow surface — Better Auth’s `Auth` generic does not match our `createBetterAuth` options. */
export type BetterAuthSessionApi = {
  readonly api: {
    getSession: (args: { headers: Headers }) => Promise<{
      user?: { id?: unknown; email?: unknown };
    } | null>;
  };
};

/**
 * Validates the bearer token and resolves the internal account id, or `null`
 * if verification fails. Lives in `api-types` so server-side feature packages
 * (`spaces`, `client-config`, …) can use it without importing from
 * `@gamezilla/auth` (which would create a feature -> feature cycle).
 */
export async function resolveAccountIdFromBearer(args: {
  db: PatchDb;
  bearerAuth: HttpBearerAuthPorts;
  bearerToken: string;
  deviceId: string;
}): Promise<string | null> {
  const { db, bearerAuth, bearerToken, deviceId } = args;
  assertUuid(deviceId, 'deviceId must be a valid UUID');
  const claims = await bearerAuth.sessionClaims.verifyBearer(bearerToken);
  if (claims === null) return null;
  return await bearerAuth.accountProvisioning.resolveInternalAccountId({
    db,
    claims,
  });
}
