import {
  PatchDbCompactionPolicyRegistry,
  type PatchDbCompactionPolicy,
} from '@gamezilla/patch-db/policy/compaction-policy';

/** Per-entity-type chain compaction for gamezilla's domain. */
export const GAMEZILLA_COMPACTION_POLICIES: Readonly<
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

export function createGamezillaCompactionPolicyRegistry(): PatchDbCompactionPolicyRegistry {
  const reg = new PatchDbCompactionPolicyRegistry();
  reg.registerAll(GAMEZILLA_COMPACTION_POLICIES);
  return reg;
}
