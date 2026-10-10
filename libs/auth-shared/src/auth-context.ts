/**
 * Application-level auth claims layered onto request/sync caller contexts (a
 * flat `Readonly<Record<string, unknown>>`). Claims are stored as namespaced
 * keywords (`auth/account-id`, …) using {@link createAttrNamespace}, so the
 * wire format stays uniform with entity attributes and the keys are validated
 * centrally.
 */
import type { AttributeState } from '@pkgs/attribute-shared/attribute';
import { createAttrNamespace } from '@pkgs/attribute-shared/attribute';

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
function readBool(v: unknown): boolean {
  return v === true || v === 1 || v === '1' || v === 'true';
}

export const AuthClaimAttr = {
  telemetryPopulation: authNs.text('telemetry-population', (value) =>
    value === 'real' || value === 'synthetic' ? value : 'unknown'
  ),
  /** Install UUID (`devices.id`). Never used as user/profile identity. */
  deviceId: authNs.text('device-id', readNonEmptyString),
  /** `users.id` when resolved (anon or signed-in), else `null`. */
  accountId: authNs.textOrNull('account-id', readNullableString),
  /** Author id for writes / sync: always `users.id` (= accountId when set). */
  myId: authNs.text('my-id', readNonEmptyString),
  /** True when `users.is_anon` for the resolved account. */
  isAnon: authNs.boolean('is-anon', readBool),
  authenticatedAtMs: authNs.numberOrNull('authenticated-at-ms', (v) =>
    typeof v === 'number' && Number.isFinite(v) ? v : null
  ),
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
  readonly synthetic?: boolean;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
  readonly isAnon: boolean;
  readonly authenticatedAtMs: number | null;
};

/** Reads {@link AuthClaimAttr} keys off a context. */
export function appAuth(
  ctx: Readonly<Record<string, unknown>>
): AppAuth | null {
  const state = ctx as AttributeState;
  const deviceId = AuthClaimAttr.deviceId.from(state);
  if (deviceId === '') return null;
  return {
    ...syntheticClaim(AuthClaimAttr.telemetryPopulation.from(state)),
    deviceId,
    accountId: AuthClaimAttr.accountId.from(state),
    myId: AuthClaimAttr.myId.from(state),
    isAnon: AuthClaimAttr.isAnon.from(state),
    authenticatedAtMs: AuthClaimAttr.authenticatedAtMs.from(state),
  };
}

/**
 * The actor identity the sync engine carries into query / mutation envs.
 * Built here so the anonymous flag travels from session to the permission
 * system without any caller in between reading it.
 */
export type SyncActor = {
  readonly synthetic?: boolean;
  readonly actorId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly isAnon: boolean;
  readonly authenticatedAtMs?: number;
};

export function syncActorOf(auth: AppAuth): SyncActor {
  return {
    ...(auth.synthetic === undefined ? {} : { synthetic: auth.synthetic }),
    actorId: auth.myId,
    deviceId: auth.deviceId,
    accountId: auth.accountId,
    isAnon: auth.isAnon,
    ...(auth.authenticatedAtMs === null
      ? {}
      : { authenticatedAtMs: auth.authenticatedAtMs }),
  };
}

/**
 * The actor for a server-initiated action taken on an account's behalf (an
 * inbox card's button): the account itself, on the device that tapped it.
 */
export function accountSyncActor(args: {
  readonly accountId: string;
  readonly deviceId: string;
}): SyncActor {
  return {
    actorId: args.accountId,
    deviceId: args.deviceId,
    accountId: args.accountId,
    isAnon: false,
  };
}

/**
 * The local device's actor for optimistic applies: the bound account, else
 * the install's `users.id`; anonymous until a session token is held.
 */
export function localSyncActor(args: {
  readonly accountId: string | null;
  readonly deviceId: string;
  readonly userId: string;
  readonly sessionToken: string | null;
}): SyncActor {
  return {
    actorId: args.accountId ?? args.userId,
    deviceId: args.deviceId,
    accountId: args.accountId,
    isAnon: args.sessionToken === null,
  };
}

export type BuildAppAuthContextArgs = {
  readonly synthetic?: boolean;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
  readonly isAnon?: boolean;
  readonly authenticatedAtMs?: number;
};

/** Builds an {@link AppAuthContext} from convenience args. */
export function buildAppAuthContext(
  args: BuildAppAuthContextArgs
): AppAuthContext {
  return {
    ...AuthClaimAttr.telemetryPopulation(
      args.synthetic === undefined
        ? 'unknown'
        : args.synthetic
          ? 'synthetic'
          : 'real'
    ),
    ...AuthClaimAttr.deviceId(args.deviceId),
    ...AuthClaimAttr.accountId(args.accountId),
    ...AuthClaimAttr.myId(args.myId),
    ...AuthClaimAttr.isAnon(args.isAnon ?? false),
    ...AuthClaimAttr.authenticatedAtMs(args.authenticatedAtMs ?? null),
  };
}

function syntheticClaim(population: string): { readonly synthetic?: boolean } {
  return population === 'unknown'
    ? {}
    : { synthetic: population === 'synthetic' };
}
