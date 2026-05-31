import {
  PatchDbCompactionPolicyRegistry,
  type PatchDbCompactionPolicy,
} from '@pkgs/patch-db/policy/compaction-policy';

/** Per-entity-type chain compaction for the app's domain. */
export const APP_COMPACTION_POLICIES: Readonly<
  Record<string, PatchDbCompactionPolicy>
> = {
  profile: { keepLatest: 2 },
  'profile.private': { keepLatest: 2 },
  space: { keepLatest: 2 },
  'space.membership': { keepLatest: 2 },
  friendship: { keepLatest: 2 },
  'friend.request': { keepLatest: 2 },
  match: { keepLatest: 2 },
  'match.score': { keepLatest: 2 },
  'inventory.item': { keepLatest: 2 },
  'stripe.catalog-price': { keepLatest: 1 },
  'stripe.catalog-product': { keepLatest: 1 },
  'stripe.customer': { keepLatest: 1 },
  'stripe.subscription': { keepLatest: 1 },
  'stripe.payment-method': { keepLatest: 1 },
  'stripe.invoice': { keepLatest: 1 },
  'stripe.charge': { keepLatest: 1 },
  'stripe.payment-intent': { keepLatest: 1 },
  'stripe.setup-intent': { keepLatest: 1 },
  'stripe.refund': { keepLatest: 1 },
  'stripe.dispute': { keepLatest: 1 },
  'stripe.checkout-session': { keepLatest: 1 },
  'stripe.webhook-event': { keepLatest: 1 },
  'stripe.webhook-event-cache': { keepLatest: 1 },
  'chat.message': 'never',
  'audit.event': 'never',
  'chess.puzzle': { keepLatest: 1 },
  'chess.puzzle.load': { keepLatest: 1 },
};

export function createAppCompactionPolicyRegistry(): PatchDbCompactionPolicyRegistry {
  const reg = new PatchDbCompactionPolicyRegistry();
  reg.registerAll(APP_COMPACTION_POLICIES);
  return reg;
}
