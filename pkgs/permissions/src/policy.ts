import type { LimitKey, PermissionKey, RoleId } from './catalog';
import type { FactPredicate } from './facts';
import type { QuotaGrant } from './quota-window';

/** One role's declarative grants, permissions, caps, quotas and parameters. */
export type RoleSpec<
  P extends string = PermissionKey,
  L extends string = LimitKey,
> = {
  /**
   * Fact predicate that assigns this role (`resolveSubject`). Roles without
   * `when` are only held when granted by another role or added explicitly.
   */
  readonly when?: FactPredicate;
  /** Roles whose grants this role also receives (transitive). */
  readonly grants?: readonly RoleId[];
  readonly permissions?: readonly P[];
  /** `null` = unlimited; a finite number is an exclusive cap (`usage < cap`). */
  readonly limits?: Readonly<Partial<Record<L, number | null>>>;
  /** Consumable allowances; merge takes the largest limit (`null` wins). */
  readonly quotas?: Readonly<Record<string, QuotaGrant>>;
  /** Numeric tuning grants; merge takes the most permissive (`null` wins). */
  readonly params?: Readonly<Record<string, number | null>>;
};

/** Deny rule layered on top of every grant. Deny always beats allow. */
export type RestrictionSpec = {
  readonly when: FactPredicate;
  readonly deny: readonly string[];
};

/** Machine-readable denial reasons. */
export type DenialReason =
  | 'not_granted'
  | 'quota_exhausted'
  | 'requires_account'
  | 'restricted';

/** Config the denial surface resolves an `unlockRef` to. Copy is by key. */
export type UnlockEntry = {
  readonly titleKey: string;
  readonly bodyKey?: string;
  readonly ctaTarget?: string;
  readonly secondaryCta?: string;
};

/** How a denied action is presented: chosen per action in config. */
export type UiTreatment = 'hide' | 'lock' | 'soft';

/** Fields every policy version carries besides its roles. */
export type PolicyVersionMeta = {
  /** Published version id carried on every decision. */
  readonly version?: string;
  /** Epoch ms this version became active (0 when absent). */
  readonly activeFromMs?: number;
  readonly restrictions?: Readonly<Record<string, RestrictionSpec>>;
  /** action → reason → unlock entry. */
  readonly unlockRefs?: Readonly<
    Record<string, Readonly<Partial<Record<DenialReason, UnlockEntry>>>>
  >;
  /** action → treatment; default `lock` for grants, `soft` for quotas. */
  readonly treatments?: Readonly<Record<string, UiTreatment>>;
  /** action → reason reported when it is simply not granted. */
  readonly denialReasons?: Readonly<Record<string, DenialReason>>;
};

/** One policy version. */
export type PolicyVersion<
  P extends string = PermissionKey,
  L extends string = LimitKey,
> = PolicyVersionMeta & {
  readonly roles: Readonly<Record<RoleId, RoleSpec<P, L>>>;
};

/** The whole declarative policy: current version plus retained priors. */
export type PermissionPolicy<
  P extends string = PermissionKey,
  L extends string = LimitKey,
> = PolicyVersion<P, L> & {
  /** Earlier versions, retained so offline replays evaluate as of then. */
  readonly history?: readonly PolicyVersion<P, L>[];
};

/** Typed identity so a policy literal is checked against the app's catalogs. */
export function definePolicy<P extends string, L extends string>(
  policy: PermissionPolicy<P, L>
): PermissionPolicy<P, L> {
  return policy;
}

/** Version id a decision under `policy` reports (`'0'` when unversioned). */
export function policyVersionOf(policy: PolicyVersionMeta): string {
  return policy.version ?? '0';
}

/**
 * The version that was active at `atMs`: the latest of the current version and
 * its history whose `activeFromMs` ≤ `atMs`. Before every version → the oldest.
 */
export function policyAt<P extends string, L extends string>(
  policy: PermissionPolicy<P, L>,
  atMs: number
): PolicyVersion<P, L> {
  const versions: PolicyVersion<P, L>[] = [policy, ...(policy.history ?? [])];
  let best: PolicyVersion<P, L> | null = null;
  let oldest: PolicyVersion<P, L> = policy;
  for (const candidate of versions) {
    const from = candidate.activeFromMs ?? 0;
    if (from < (oldest.activeFromMs ?? 0)) oldest = candidate;
    if (from > atMs) continue;
    if (best === null || from > (best.activeFromMs ?? 0)) best = candidate;
  }
  return best ?? oldest;
}
