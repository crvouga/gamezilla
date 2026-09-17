/**
 * The IdP's own internal state. It is deliberately *not* shared with the
 * relying party: the provider owns its accounts, its browser sessions, its
 * grants and its tokens, exactly as Google does. A relying party can only
 * learn about them by completing a real OAuth flow (or by using the test-only
 * admin plane).
 */

import type { Clock } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid';

import {
  IDP_DEFAULT_FAULTS,
  type IdpAccessToken,
  type IdpAccount,
  type IdpAuthCode,
  type IdpAuthRequest,
  type IdpBrowserSession,
  type IdpClient,
  type IdpFaults,
  type IdpRefreshToken,
} from '../shared/types';

/** Google authorization codes are short lived; ten minutes is the documented cap. */
export const IDP_AUTH_CODE_TTL_MS = 10 * 60 * 1000;
/** Google access tokens come back with `expires_in: 3599`. */
export const IDP_ACCESS_TOKEN_TTL_MS = 3599 * 1000;
/** Parked authorize requests expire so an abandoned tab cannot be resumed. */
export const IDP_AUTH_REQUEST_TTL_MS = 30 * 60 * 1000;
/**
 * Codes are kept well past their TTL so a late exchange gets the honest
 * `invalid_grant` / "Code has expired" answer rather than "malformed".
 */
export const IDP_AUTH_CODE_RETENTION_MS = 60 * 60 * 1000;

export type IdpStateDeps = {
  readonly clock: Clock;
  readonly createId: CreateId;
};

export type IdpState = {
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly accounts: Map<string, IdpAccount>;
  readonly clients: Map<string, IdpClient>;
  readonly sessions: Map<string, IdpBrowserSession>;
  readonly authRequests: Map<string, IdpAuthRequest>;
  readonly authCodes: Map<string, IdpAuthCode>;
  readonly accessTokens: Map<string, IdpAccessToken>;
  readonly refreshTokens: Map<string, IdpRefreshToken>;
  /** `sub|clientId` → scopes the human has already approved. */
  readonly grants: Map<string, readonly string[]>;
  faults: IdpFaults;
};

export function createIdpState(deps: IdpStateDeps): IdpState {
  return {
    clock: deps.clock,
    createId: deps.createId,
    accounts: new Map(),
    clients: new Map(),
    sessions: new Map(),
    authRequests: new Map(),
    authCodes: new Map(),
    accessTokens: new Map(),
    refreshTokens: new Map(),
    grants: new Map(),
    faults: IDP_DEFAULT_FAULTS,
  };
}

export function grantKey(sub: string, clientId: string): string {
  return `${sub}|${clientId}`;
}

export function hasGrant(
  state: IdpState,
  sub: string,
  clientId: string,
  scopes: readonly string[]
): boolean {
  const approved = state.grants.get(grantKey(sub, clientId));
  if (approved === undefined) return false;
  return scopes.every((scope) => approved.includes(scope));
}

export function recordGrant(
  state: IdpState,
  sub: string,
  clientId: string,
  scopes: readonly string[]
): void {
  const key = grantKey(sub, clientId);
  const approved = state.grants.get(key) ?? [];
  const merged = [...new Set([...approved, ...scopes])].sort();
  state.grants.set(key, merged);
}

export function ensureSession(
  state: IdpState,
  sessionId: string | null
): IdpBrowserSession {
  const existing =
    sessionId === null ? undefined : state.sessions.get(sessionId);
  if (existing !== undefined) return existing;
  const created: IdpBrowserSession = { id: state.createId(), signedIn: [] };
  state.sessions.set(created.id, created);
  return created;
}

export function markSignedIn(session: IdpBrowserSession, sub: string): void {
  const at = session.signedIn.indexOf(sub);
  if (at >= 0) session.signedIn.splice(at, 1);
  session.signedIn.push(sub);
}

/** Accounts the chooser should offer, most recently used first. */
export function sessionAccounts(
  state: IdpState,
  session: IdpBrowserSession
): readonly IdpAccount[] {
  return [...session.signedIn]
    .reverse()
    .map((sub) => state.accounts.get(sub))
    .filter((account): account is IdpAccount => account !== undefined);
}

export function findAccountByEmail(
  state: IdpState,
  email: string
): IdpAccount | null {
  const needle = email.trim().toLowerCase();
  for (const account of state.accounts.values()) {
    if (account.email.toLowerCase() === needle) return account;
  }
  return null;
}

/** Drop everything time has invalidated so state cannot grow without bound. */
export function sweepExpired(state: IdpState): void {
  const now = state.clock.now();
  for (const [id, request] of state.authRequests) {
    if (now - request.createdAtMs > IDP_AUTH_REQUEST_TTL_MS) {
      state.authRequests.delete(id);
    }
  }
  for (const [code, entry] of state.authCodes) {
    if (now > entry.expiresAtMs + IDP_AUTH_CODE_RETENTION_MS) {
      state.authCodes.delete(code);
    }
  }
  for (const [token, entry] of state.accessTokens) {
    if (now > entry.expiresAtMs) state.accessTokens.delete(token);
  }
}

/**
 * Google kills the whole grant when an authorization code is replayed. Mirror
 * that: a replay must not leave the earlier tokens usable.
 */
export function revokeGrantTokens(
  state: IdpState,
  sub: string,
  clientId: string
): void {
  for (const [token, entry] of state.accessTokens) {
    if (entry.sub === sub && entry.clientId === clientId) {
      state.accessTokens.delete(token);
    }
  }
  for (const entry of state.refreshTokens.values()) {
    if (entry.sub === sub && entry.clientId === clientId) entry.revoked = true;
  }
}
