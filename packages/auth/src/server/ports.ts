import type { PatchDb, PatchDbContext } from '@gamezilla/patch-db/interface';
import type { AuthContext } from './types';

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

export interface AuthSessionPort {
  resolvePatchDbContext(db: PatchDb, request: Request): Promise<PatchDbContext>;
  requireAuthContext(db: PatchDb, request: Request): Promise<AuthContext>;
}
