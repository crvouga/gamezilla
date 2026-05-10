/**
 * Unauthenticated HTTP caller. Carries no identity claims; ABAC policies
 * decide what unauthenticated clients can read (typically only public entity
 * types like client config). Apps may extend this with extra claims via
 * intersection (the patch-db library never inspects them).
 */
export type PatchDbClientContext = {
  readonly deviceId?: undefined;
};

/**
 * Authenticated caller. `deviceId` is the client-generated replication
 * identity. Consuming apps extend via intersection to carry their own claims
 * (e.g. `accountId`, group memberships) into their visibility policies.
 */
export type PatchDbAuthContext = {
  readonly deviceId: string;
  readonly [claim: string]: unknown;
};

/**
 * System / simulation / migration — bypasses any hook-based ABAC checks.
 * `reason` is a free-form string so apps can tag privileged contexts
 * (e.g. `'stripe-webhook'`) without modifying the library.
 */
export type PatchDbSystemContext = {
  deviceId: null;
  reason: string;
};

export type PatchDbContext =
  | PatchDbClientContext
  | PatchDbAuthContext
  | PatchDbSystemContext;

/** Default for local-first client DB, tests, and in-process sim — no ABAC filtering. */
export const OPEN_PATCHES_DB_CONTEXT: PatchDbSystemContext = {
  deviceId: null,
  reason: 'sim',
};

/** Server-side privileged operations (auth claim, session resolution bootstrap). */
export const PATCHES_DB_SYSTEM_CONTEXT: PatchDbSystemContext = {
  deviceId: null,
  reason: 'system',
};

export function isPatchDbSystemContext(
  ctx: PatchDbContext
): ctx is PatchDbSystemContext {
  return ctx.deviceId === null;
}

export function isPatchDbAuthContext(
  ctx: PatchDbContext
): ctx is PatchDbAuthContext {
  return typeof ctx.deviceId === 'string';
}

export function isPatchDbClientContext(
  ctx: PatchDbContext
): ctx is PatchDbClientContext {
  return !isPatchDbAuthContext(ctx) && !isPatchDbSystemContext(ctx);
}
