/**
 * Application-level auth claims layered onto the generic patch-db caller
 * context (a flat `Readonly<Record<string, unknown>>`). Patch-db itself is
 * decoupled from these claims; this module owns the schema and the helpers
 * that policies use to read them back.
 *
 * Claims are stored as namespaced keywords (`auth/account-id`, …) using
 * {@link createAttrNamespace}, so the wire format stays uniform with patch
 * attributes and the keys are validated centrally.
 */
import { type AttributeState, createAttrNamespace } from '@pkgs/attribute';
import { ForbiddenError } from '@pkgs/patch-db/forbidden-error';
import {
  isPatchDbSystemContext,
  type PatchDbQueryWhereClause,
  type PatchInput,
  PATCH_CREATED_BY_ID,
  READ_WHERE_NEVER_TRUE,
} from '@pkgs/patch-db/interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@pkgs/patch-db/policy/system-device';

const authNs = createAttrNamespace('auth');

function readNonEmptyString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNullableString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Namespaced auth claim keys that {@link AppAuth} carries on a patch-db
 * context. Use the tag's call form (`AuthClaimAttr.deviceId(id)`) to spread a
 * single claim into a context, and `.from(state)` to extract it.
 *
 * Auth only owns identity (device / account / author). Domain-scoped claims
 * such as space membership or friend lists live in their own packages and use
 * their own attribute namespaces — auth must not know about them.
 */
export const AuthClaimAttr = {
  /** Install / replication device UUID. Empty string when truly anonymous. */
  deviceId: authNs.text('device-id', readNonEmptyString),
  /** Account UUID when signed in, else `null`. */
  accountId: authNs.textOrNull('account-id', readNullableString),
  /** Author id used by patch metadata: `accountId ?? deviceId`. */
  myId: authNs.text('my-id', readNonEmptyString),
} as const;

/**
 * Authenticated app caller — structurally a `Readonly<Record<string, unknown>>`
 * (a claim bag) carrying the keys defined by {@link AuthClaimAttr}. Patch-db
 * does not see this type; it lives entirely in the auth layer.
 */
export type AppAuthContext = Readonly<Record<string, unknown>>;

/** Marker for unauthenticated HTTP callers (no Bearer, no `x-anon-id`). */
export type AppClientContext = Readonly<Record<string, unknown>>;

/**
 * Decoded view of an {@link AppAuthContext}. Policies receive this from
 * {@link authOnlyRead} / {@link appAuthFromWriteContext} so they can keep
 * dot-access (`auth.accountId`) without each call repeating
 * `AuthClaimAttr.X.from(ctx)`.
 */
export type AppAuth = {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
};

/**
 * Reads {@link AuthClaimAttr} keys off a non-system context. Returns `null`
 * for system contexts (which bypass ABAC anyway).
 */
export function appAuth(
  ctx: Readonly<Record<string, unknown>>
): AppAuth | null {
  if (isPatchDbSystemContext(ctx)) return null;
  const state = ctx as AttributeState;
  return {
    deviceId: AuthClaimAttr.deviceId.from(state),
    accountId: AuthClaimAttr.accountId.from(state),
    myId: AuthClaimAttr.myId.from(state),
  };
}

export type BuildAppAuthContextArgs = {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
};

/**
 * Builds an {@link AppAuthContext} (a flat `Record<string, unknown>`) from
 * convenience args. Use this at the request boundary instead of constructing
 * the bag by hand so the namespaced keys stay in one place.
 *
 * Domain-scoped claims (space membership, etc.) are added later by their own
 * packages — typically lazily through a patch-db `enrichContext` hook.
 */
export function buildAppAuthContext(
  args: BuildAppAuthContextArgs
): AppAuthContext {
  return {
    ...AuthClaimAttr.deviceId(args.deviceId),
    ...AuthClaimAttr.accountId(args.accountId),
    ...AuthClaimAttr.myId(args.myId),
  };
}

/**
 * Wraps an authenticated-only read function so it can be assigned directly to
 * `VisibilityPolicy.read`. Unauthenticated clients (no `auth/device-id`
 * claim) get {@link READ_WHERE_NEVER_TRUE} (no rows) without each policy
 * repeating the narrowing check.
 *
 * The callback gets the decoded auth view plus the raw context so policies
 * that span bounded contexts can read non-auth claims (e.g. space membership)
 * via that domain's own claim helpers.
 */
export function authOnlyRead(
  fn: (auth: AppAuth, ctx: AppAuthContext) => PatchDbQueryWhereClause
): (ctx: AppAuthContext) => PatchDbQueryWhereClause {
  return (ctx) => {
    const auth = appAuth(ctx);
    if (auth === null || auth.deviceId === '') return READ_WHERE_NEVER_TRUE;
    return fn(auth, ctx);
  };
}

/**
 * Returns the decoded view for write hooks, or `null` for unauthenticated
 * client writes. (System writes are filtered out before the policy runs.)
 */
export function appAuthFromWriteContext(
  ctx: Readonly<Record<string, unknown>>
): AppAuth | null {
  const auth = appAuth(ctx);
  if (auth === null || auth.deviceId === '') return null;
  return auth;
}

function createdBy(patch: PatchInput): string {
  const raw = patch as Record<string, unknown>;
  const top =
    typeof raw['createdBy'] === 'string' ? (raw['createdBy'] as string) : '';
  const attr = patch.attributes[PATCH_CREATED_BY_ID];
  return top || (typeof attr === 'string' ? attr : '');
}

export function assertCreatedByMatchesAuthor(
  auth: AppAuth,
  patch: PatchInput
): void {
  const cb = createdBy(patch);
  if (cb !== auth.myId && cb !== PATCH_DB_SYSTEM_DEVICE_ID) {
    throw new ForbiddenError('patch/created-by-id must match author', {
      expected: auth.myId,
      actual: cb,
    });
  }
}
