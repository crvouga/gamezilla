/**
 * Anonymous visitor identified by a server-set cookie. Has no principalId
 * or accountId — ABAC policies decide what visitors can read (typically
 * only public entity types like client config).
 */
export type PatchDbVisitorContext = {
  readonly visitorId: string;
  readonly principalId?: undefined;
};

/**
 * Authenticated caller identifier. `principalId` is the client-generated
 * device identity; `visitorId` is the server-assigned cookie identity.
 * Consuming apps extend via intersection to carry their own claims
 * (e.g. `accountId`, group memberships) into their visibility policies.
 */
export type PatchDbAuthContext = {
  readonly visitorId: string;
  readonly principalId: string;
  readonly [claim: string]: unknown;
};

/**
 * System / simulation / migration — bypasses any hook-based ABAC checks.
 * `reason` is a free-form string so apps can tag privileged contexts
 * (e.g. `'stripe-webhook'`) without modifying the library.
 */
export type PatchDbSystemContext = {
  principalId: null;
  reason: string;
};

export type PatchDbContext =
  | PatchDbVisitorContext
  | PatchDbAuthContext
  | PatchDbSystemContext;

/** Default for local-first client DB, tests, and in-process sim — no ABAC filtering. */
export const OPEN_PATCHES_DB_CONTEXT: PatchDbSystemContext = {
  principalId: null,
  reason: 'sim',
};

/** Server-side privileged operations (auth claim, session resolution bootstrap). */
export const PATCHES_DB_SYSTEM_CONTEXT: PatchDbSystemContext = {
  principalId: null,
  reason: 'system',
};

export function isPatchDbSystemContext(
  ctx: PatchDbContext
): ctx is PatchDbSystemContext {
  return ctx.principalId === null;
}

export function isPatchDbAuthContext(
  ctx: PatchDbContext
): ctx is PatchDbAuthContext {
  return typeof ctx.principalId === 'string';
}

export function isPatchDbVisitorContext(
  ctx: PatchDbContext
): ctx is PatchDbVisitorContext {
  return (
    'visitorId' in ctx &&
    typeof (ctx as Record<string, unknown>)['visitorId'] === 'string' &&
    ctx.principalId !== null &&
    typeof ctx.principalId !== 'string'
  );
}
