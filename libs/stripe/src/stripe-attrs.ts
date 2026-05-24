/**
 * {@link AttributeTag}s for Stripe patch-db rows (stable wire keys).
 */
import { createAttrNamespace } from '@pkgs/attribute';

function readJsonObject(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

function readString(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const stripeNs = createAttrNamespace('stripe');

export const StripeAttr = {
  /** Raw Stripe event/object body mirrored verbatim. */
  payload: stripeNs.json('payload', readJsonObject),
  /** Stripe `object` discriminant (`customer`, `subscription`, …). */
  objectType: stripeNs.text('object-type', readString),
  /** Wire source (`webhook`, `polling`, …). */
  source: stripeNs.text('source', readString),
  /** Stripe webhook event type (`customer.created`, …). */
  webhookEventType: stripeNs.text('webhook-event-type', readString),
  /** Stripe object id (`cus_…`, `sub_…`, `evt_…`). */
  stripeObjectId: stripeNs.text('stripe-object-id', readString),
} as const;

const entityNs = createAttrNamespace('entity');

/** `entity/owner` — same namespace as API ABAC; used on Stripe mirror rows. */
export const StripeEntityAttr = {
  owner: entityNs.text('owner', readString),
} as const;
