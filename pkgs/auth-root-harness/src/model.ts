/**
 * The reference model: what *should* happen, written independently of the
 * auth app's code.
 *
 * Every auth action predicts its outcome from this model before the real
 * system runs, then compares. The model is the specification of account
 * linking in executable form:
 *
 * - a known identity signs in as its owner;
 * - a new identity joins the user whose identity shares its address only
 *   when both addresses are provider-verified (and never a relay address);
 * - a match with either side unverified must be proven (pending link) or
 *   declined — never linked silently;
 * - one identity per provider per user; identities never change owner while
 *   linked; the last identity cannot be unlinked;
 * - sessions end by sign-out, sign-out-everywhere, Apple consent revocation,
 *   Apple account deletion (when nothing else can sign in), or expiry.
 */

import { AUTH_SESSION_TTL_MS } from '@pkgs/auth-inhouse-shared/auth-constants';
import type { AuthErrorCode } from '@pkgs/auth-root-shared/auth-error-code';
import { AUTH_ERROR } from '@pkgs/auth-root-shared/auth-error-code';
import type { OauthProviderId } from '@pkgs/auth-root-shared/sign-in-method';

/** What the relying party learns about one provider identity. */
export type SeenIdentity = {
  readonly provider: OauthProviderId;
  readonly sub: string;
  readonly email: string | null;
  readonly verified: boolean;
  readonly isPrivate: boolean;
};

export type ModelIdentity = SeenIdentity & { readonly userId: string };

/**
 * `linked` / `link_required` name every user the policy allows: two users
 * can share an address (one declined linking), and which one an identity
 * joins then depends only on link order — the model accepts either.
 */
export type Prediction =
  | { readonly kind: 'existing'; readonly userId: string }
  | { readonly kind: 'new' }
  | { readonly kind: 'linked'; readonly userIds: readonly string[] }
  | {
      readonly kind: 'link_required';
      readonly targetUserIds: readonly string[];
    }
  | { readonly kind: 'error'; readonly code: AuthErrorCode };

export type AuthModel = {
  readonly identities: Map<string, ModelIdentity>;
  readonly users: Set<string>;
  /**
   * Actor → the session its bearer holds. Keyed by device, identified by
   * token: a stolen copy shares the server session, and dies with it.
   */
  readonly sessions: Map<
    string,
    { userId: string; expiresAtMs: number; token: string }
  >;
  /** Pending-link token → the user it waits to be proven against. */
  readonly pendings: Map<
    string,
    { targetUserId: string; identity: SeenIdentity; expiresAtMs: number }
  >;
};

export function createAuthModel(): AuthModel {
  return {
    identities: new Map(),
    users: new Set(),
    sessions: new Map(),
    pendings: new Map(),
  };
}

export function identityKey(provider: string, sub: string): string {
  return `${provider}|${sub}`;
}

export function identitiesOf(
  model: AuthModel,
  userId: string
): ModelIdentity[] {
  return [...model.identities.values()].filter((row) => row.userId === userId);
}

function hasProvider(
  model: AuthModel,
  userId: string,
  provider: OauthProviderId
): boolean {
  return identitiesOf(model, userId).some((row) => row.provider === provider);
}

/** Users whose identities share the address and could take this provider. */
function candidates(model: AuthModel, seen: SeenIdentity): ModelIdentity[] {
  if (seen.email === null || seen.isPrivate) return [];
  return [...model.identities.values()].filter(
    (row) =>
      !row.isPrivate &&
      row.email === seen.email &&
      !hasProvider(model, row.userId, seen.provider)
  );
}

export function predictSignIn(
  model: AuthModel,
  seen: SeenIdentity
): Prediction {
  const known = model.identities.get(identityKey(seen.provider, seen.sub));
  if (known !== undefined) return { kind: 'existing', userId: known.userId };
  const matches = candidates(model, seen);
  if (matches.length === 0) return { kind: 'new' };
  const verified = matches.filter((row) => row.verified);
  if (seen.verified && verified.length > 0) {
    return { kind: 'linked', userIds: verified.map((row) => row.userId) };
  }
  return {
    kind: 'link_required',
    targetUserIds: matches.map((row) => row.userId),
  };
}

export function predictLink(
  model: AuthModel,
  userId: string,
  seen: SeenIdentity
): Prediction {
  const known = model.identities.get(identityKey(seen.provider, seen.sub));
  if (known !== undefined) {
    return known.userId === userId
      ? { kind: 'existing', userId }
      : { kind: 'error', code: AUTH_ERROR.identityAlreadyLinked };
  }
  if (hasProvider(model, userId, seen.provider)) {
    return { kind: 'error', code: AUTH_ERROR.providerAlreadyLinked };
  }
  return { kind: 'linked', userIds: [userId] };
}

/** Proving a pending link: the prover must be the user it waits for. */
export function predictConfirm(
  model: AuthModel,
  token: string,
  prover: SeenIdentity,
  nowMs: number
): Prediction {
  const pending = model.pendings.get(token);
  if (pending === undefined || pending.expiresAtMs <= nowMs) {
    return { kind: 'error', code: AUTH_ERROR.expired };
  }
  const known = model.identities.get(identityKey(prover.provider, prover.sub));
  if (known === undefined || known.userId !== pending.targetUserId) {
    return { kind: 'error', code: AUTH_ERROR.linkMismatch };
  }
  const parked = pending.identity;
  const owner = model.identities.get(identityKey(parked.provider, parked.sub));
  if (owner !== undefined) {
    // Linked to this very account meanwhile: nothing left to do.
    return owner.userId === known.userId
      ? { kind: 'existing', userId: known.userId }
      : { kind: 'error', code: AUTH_ERROR.identityAlreadyLinked };
  }
  if (hasProvider(model, known.userId, parked.provider)) {
    return { kind: 'error', code: AUTH_ERROR.providerAlreadyLinked };
  }
  return { kind: 'linked', userIds: [known.userId] };
}

export function attachIdentity(
  model: AuthModel,
  userId: string,
  seen: SeenIdentity
): void {
  model.users.add(userId);
  model.identities.set(identityKey(seen.provider, seen.sub), {
    ...seen,
    userId,
  });
}

/** A known identity signed in again: the provider may say something new. */
export function refreshIdentity(model: AuthModel, seen: SeenIdentity): void {
  const key = identityKey(seen.provider, seen.sub);
  const known = model.identities.get(key);
  if (known !== undefined)
    model.identities.set(key, { ...seen, userId: known.userId });
}

export function startSession(
  model: AuthModel,
  actorId: string,
  session: {
    readonly userId: string;
    readonly token: string;
    readonly nowMs: number;
  }
): void {
  model.sessions.set(actorId, {
    userId: session.userId,
    token: session.token,
    expiresAtMs: session.nowMs + AUTH_SESSION_TTL_MS,
  });
}

/** The server revoked one session: every device holding that token loses it. */
export function endToken(model: AuthModel, token: string): void {
  for (const [actorId, session] of model.sessions) {
    if (session.token === token) model.sessions.delete(actorId);
  }
}

/** Every session the user holds, on every actor, ends. */
export function endUserSessions(model: AuthModel, userId: string): void {
  for (const [actorId, session] of model.sessions) {
    if (session.userId === userId) model.sessions.delete(actorId);
  }
}

/** The user an actor should be signed in as right now, if any. */
export function expectedUser(
  model: AuthModel,
  actorId: string,
  nowMs: number
): string | null {
  const session = model.sessions.get(actorId);
  if (session === undefined || session.expiresAtMs <= nowMs) return null;
  return session.userId;
}
