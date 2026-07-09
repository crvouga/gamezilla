/**
 * Application-level auth claims layered onto request/sync caller contexts (a
 * flat `Readonly<Record<string, unknown>>`). Claims are stored as namespaced
 * keywords (`auth/account-id`, …) using {@link createAttrNamespace}, so the
 * wire format stays uniform with entity attributes and the keys are validated
 * centrally.
 */
import { type AttributeState, createAttrNamespace } from '@pkgs/attribute';

const authNs = createAttrNamespace('auth');

function readNonEmptyString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function readNullableString(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/**
 * Namespaced auth claim keys that {@link AppAuth} carries on a caller context.
 * Use the tag's call form (`AuthClaimAttr.deviceId(id)`) to spread a single
 * claim into a context, and `.from(state)` to extract it.
 */
export const AuthClaimAttr = {
  /** Install / replication device UUID. Empty string when truly anonymous. */
  deviceId: authNs.text('device-id', readNonEmptyString),
  /** Account UUID when signed in, else `null`. */
  accountId: authNs.textOrNull('account-id', readNullableString),
  /** Author id used by write metadata: `accountId ?? deviceId`. */
  myId: authNs.text('my-id', readNonEmptyString),
} as const;

/**
 * Authenticated app caller — structurally a `Readonly<Record<string, unknown>>`
 * (a claim bag) carrying the keys defined by {@link AuthClaimAttr}.
 */
export type AppAuthContext = Readonly<Record<string, unknown>>;

/** Marker for unauthenticated HTTP callers (no Bearer, no `x-anon-id`). */
export type AppClientContext = Readonly<Record<string, unknown>>;

/**
 * Decoded view of an {@link AppAuthContext}. Policies receive this from
 * {@link appAuth} so they can keep dot-access (`auth.accountId`) without each
 * call repeating `AuthClaimAttr.X.from(ctx)`.
 */
export type AppAuth = {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
};

/** Reads {@link AuthClaimAttr} keys off a context. */
export function appAuth(
  ctx: Readonly<Record<string, unknown>>
): AppAuth | null {
  const state = ctx as AttributeState;
  const deviceId = AuthClaimAttr.deviceId.from(state);
  if (deviceId === '') return null;
  return {
    deviceId,
    accountId: AuthClaimAttr.accountId.from(state),
    myId: AuthClaimAttr.myId.from(state),
  };
}

export type BuildAppAuthContextArgs = {
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
};

/** Builds an {@link AppAuthContext} from convenience args. */
export function buildAppAuthContext(
  args: BuildAppAuthContextArgs
): AppAuthContext {
  return {
    ...AuthClaimAttr.deviceId(args.deviceId),
    ...AuthClaimAttr.accountId(args.accountId),
    ...AuthClaimAttr.myId(args.myId),
  };
}
