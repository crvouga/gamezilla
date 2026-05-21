/**
 * {@link AttributeTag}s for Stripe patch-db rows (stable wire keys).
 */
import { createAttrNamespace } from '@pkgs/attribute';

const passthrough = (v: unknown): unknown => v;

const stripeNs = createAttrNamespace('stripe');

export const StripeAttr = {
  payload: stripeNs('payload', passthrough),
  objectType: stripeNs('object-type', passthrough),
  source: stripeNs('source', passthrough),
  webhookEventType: stripeNs('webhook-event-type', passthrough),
  stripeObjectId: stripeNs('stripe-object-id', passthrough),
} as const;

const entityNs = createAttrNamespace('entity');

/** `entity/owner` — same namespace as API ABAC; used on Stripe mirror rows. */
export const StripeEntityAttr = {
  owner: entityNs('owner', passthrough),
} as const;
