/**
 * Patch-db caller contexts. The library is **app-agnostic**: a non-system context is a
 * flat {@link PatchDbClaimsContext} keyed by {@link Keyword} claims; the library never
 * interprets claim values. Apps stamp identity claims onto the record via
 * {@link @gamezilla/lib/attribute.createAttrNamespace} and read them back from their own
 * visibility policies / write hooks.
 *
 * The only structural distinction the library cares about is **system bypass**
 * — privileged callers (migrations, scripts, webhooks) skip ABAC entirely.
 * That branch is identified at runtime by a non-keyword brand key
 * (`__patchdb_system__`) which can never collide with an application claim
 * because real claim keys are namespaced keywords (`prefix/local`).
 *
 * Context enrichment (e.g. lazy-loading group memberships from a bearer
 * token) lives outside this file in {@link PatchDbHooks.enrichContext}
 * pipelines registered at the composition root. Enrichers run once per
 * `read` / `write` batch, just before visibility checks see the context.
 */

import type { Assert } from '@gamezilla/lib/assert';
import { assert } from '@gamezilla/lib/assert';
import { assertKeywordRecord, type Keyword } from '@gamezilla/lib/keyword';

/** Brand key for system-bypass contexts; not a valid {@link Keyword}. */
export const PATCH_DB_SYSTEM_BRAND = '__patchdb_system__' as const;

export type PatchDbSystemContext = Readonly<{
  readonly __patchdb_system__: true;
  readonly reason: string;
}>;

/** Caller claim bag: every key must be a wire-valid namespaced keyword. */
export type PatchDbClaimsContext = Readonly<Record<Keyword, unknown>>;

export type PatchDbContext = PatchDbSystemContext | PatchDbClaimsContext;

function makeSystemContext(reason: string): PatchDbSystemContext {
  return { [PATCH_DB_SYSTEM_BRAND]: true, reason } as PatchDbSystemContext;
}

/** Default for local-first client DB, tests, and in-process sim — no ABAC filtering. */
export const OPEN_PATCHES_DB_CONTEXT: PatchDbSystemContext =
  makeSystemContext('sim');

/** Server-side privileged operations (auth claim, session resolution bootstrap). */
export const PATCHES_DB_SYSTEM_CONTEXT: PatchDbSystemContext =
  makeSystemContext('system');

/** Build a labelled system-bypass context (e.g. webhooks, migrations, scripts). */
export function patchDbSystemContext(reason: string): PatchDbSystemContext {
  return makeSystemContext(reason);
}

/**
 * Runtime check for the system-bypass branch. Apps differentiate "client"
 * vs "auth" callers themselves by inspecting their own claim keys (e.g.
 * `auth/account-id`); the library doesn't.
 */
export function isPatchDbSystemContext(
  ctx: PatchDbContext
): ctx is PatchDbSystemContext {
  return (ctx as Record<string, unknown>)[PATCH_DB_SYSTEM_BRAND] === true;
}

/**
 * Trust-boundary assertion: either a {@link PatchDbSystemContext} or a plain
 * record whose own-enumerable keys are all namespaced keywords.
 */
export function assertPatchDbContext(
  ctx: unknown,
  a: Assert = assert
): asserts ctx is PatchDbContext {
  a.record(ctx, 'patch-db ctx must be object');
  const rec = ctx as Record<string, unknown>;
  if (rec[PATCH_DB_SYSTEM_BRAND] === true) {
    a.string(rec['reason'], 'patch-db system ctx.reason must be string');
    return;
  }
  assertKeywordRecord(rec as Record<string, unknown>, 'patch-db ctx claims');
}
