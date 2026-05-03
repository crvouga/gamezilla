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
  'stripe.catalog_price': { keepLatest: 1 },
  'stripe.catalog_product': { keepLatest: 1 },
  'stripe.customer': { keepLatest: 1 },
  'stripe.subscription': { keepLatest: 1 },
  'stripe.paymentMethod': { keepLatest: 1 },
  'stripe.invoice': { keepLatest: 1 },
  'stripe.charge': { keepLatest: 1 },
  'stripe.payment_intent': { keepLatest: 1 },
  'stripe.setup_intent': { keepLatest: 1 },
  'stripe.refund': { keepLatest: 1 },
  'stripe.dispute': { keepLatest: 1 },
  'stripe.checkout_session': { keepLatest: 1 },
  'stripe.webhook_event': { keepLatest: 1 },
  'chat.message': 'never',
  'audit.event': 'never',
};

export function createGamezillaCompactionPolicyRegistry(): PatchDbCompactionPolicyRegistry {
  const reg = new PatchDbCompactionPolicyRegistry();
  reg.registerAll(GAMEZILLA_COMPACTION_POLICIES);
  return reg;
}
