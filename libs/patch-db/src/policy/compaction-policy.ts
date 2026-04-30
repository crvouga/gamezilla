/** Per-entity-type chain compaction: tail-N merge or never (append-only). */
export type PatchDbCompactionPolicy = { keepLatest: number } | 'never';

export const DEFAULT_PATCH_DB_COMPACTION_POLICIES: Readonly<
  Record<string, PatchDbCompactionPolicy>
> = {
  profile: { keepLatest: 2 },
  'profile.private': { keepLatest: 2 },
  space: { keepLatest: 2 },
  spaceMembership: { keepLatest: 2 },
  friendship: { keepLatest: 2 },
  'friend.request': { keepLatest: 2 },
  match: { keepLatest: 2 },
  'match.score': { keepLatest: 2 },
  'inventory.item': { keepLatest: 2 },
  'stripe.subscription': { keepLatest: 2 },
  'stripe.paymentMethod': { keepLatest: 2 },
  'stripe.invoice': { keepLatest: 2 },
  'stripe.webhook_event': { keepLatest: 2 },
  'chat.message': 'never',
  'audit.event': 'never',
};

export function resolvePatchDbCompactionPolicy(
  entityType: string
): PatchDbCompactionPolicy {
  return DEFAULT_PATCH_DB_COMPACTION_POLICIES[entityType] ?? {
    keepLatest: 2,
  };
}
