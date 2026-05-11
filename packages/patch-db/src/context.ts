/**
 * Patch-db caller contexts. The library is **app-agnostic**: a context is a
 * flat `Readonly<Record<string, unknown>>` claim bag and the library never
 * inspects keys. Apps stamp identity claims onto the record (preferably as
 * namespaced keywords via {@link `@gamezilla/lib/attribute`.createAttrNamespace})
 * and read them back from their own visibility policies / write hooks.
 *
 * The only structural distinction the library cares about is **system bypass**
 * — privileged callers (migrations, scripts, webhooks) skip ABAC entirely.
 * That branch is identified at runtime by a non-keyword brand key
 * (`__patchdb_system__`) which can never collide with an application claim
 * because real claim keys are namespaced keywords (`prefix/local`).
 *
 * Context enrichment (e.g. lazy-loading group memberships from a bearer
 * token) lives outside this file in {@link PatchDbHooks.enrichContext}
 * pipelines registered by the composition root. Enrichers run once per
 * `read` / `write` batch, just before visibility checks see the context.
 */

const PATCH_DB_SYSTEM_BRAND = '__patchdb_system__' as const;

function makeSystemContext(reason: string): Readonly<Record<string, unknown>> {
  return { [PATCH_DB_SYSTEM_BRAND]: true, reason };
}

/** Default for local-first client DB, tests, and in-process sim — no ABAC filtering. */
export const OPEN_PATCHES_DB_CONTEXT: Readonly<Record<string, unknown>> =
  makeSystemContext('sim');

/** Server-side privileged operations (auth claim, session resolution bootstrap). */
export const PATCHES_DB_SYSTEM_CONTEXT: Readonly<Record<string, unknown>> =
  makeSystemContext('system');

/** Build a labelled system-bypass context (e.g. webhooks, migrations, scripts). */
export function patchDbSystemContext(
  reason: string
): Readonly<Record<string, unknown>> {
  return makeSystemContext(reason);
}

/**
 * Runtime check for the system-bypass branch. Apps differentiate "client"
 * vs "auth" callers themselves by inspecting their own claim keys (e.g.
 * `auth/account-id`); the library doesn't.
 */
export function isPatchDbSystemContext(
  ctx: Readonly<Record<string, unknown>>
): boolean {
  return ctx[PATCH_DB_SYSTEM_BRAND] === true;
}
