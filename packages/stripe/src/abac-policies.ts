import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import type { PatchDbQueryWhereClause } from '@gamezilla/patch-db/interface';
import {
  isPatchDbSystemContext,
  READ_WHERE_ALWAYS_TRUE,
  READ_WHERE_NEVER_TRUE,
} from '@gamezilla/patch-db/interface';
import type { VisibilityPolicy } from '@gamezilla/patch-db/policy/visibility-policy-registry';

import { AbacEntityAttr } from '@gamezilla/patch-db/abac/abac-entity-attr';
import {
  authOnlyRead,
  type AppAuthContext,
} from '@gamezilla/patch-db/abac/app-auth-context';

type AppVisibilityPolicy = VisibilityPolicy<AppAuthContext>;

const stripeOwnerScopedRead = authOnlyRead((ctx): PatchDbQueryWhereClause => {
  if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
  return {
    type: '=',
    attribute: AbacEntityAttr.owner.key,
    value: ctx.accountId,
  };
});

const stripeSubscriptionPolicy: AppVisibilityPolicy = {
  read: stripeOwnerScopedRead,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.subscription is system-only');
  },
};

const stripePaymentMethodPolicy: AppVisibilityPolicy = {
  read: stripeOwnerScopedRead,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.payment-method is system-only');
  },
};

const stripeInvoicePolicy: AppVisibilityPolicy = {
  read: stripeOwnerScopedRead,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.invoice is system-only');
  },
};

const stripeWebhookEventPolicy: AppVisibilityPolicy = {
  read: stripeOwnerScopedRead,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.webhook-event is system-only');
  },
};

/** Catalog rows are global; any authenticated caller may read for checkout. */
const stripeCatalogPricePolicy: AppVisibilityPolicy = {
  read: authOnlyRead(() => READ_WHERE_ALWAYS_TRUE),
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.catalog-price is system-only');
  },
};

const stripeCatalogProductPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(() => READ_WHERE_ALWAYS_TRUE),
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.catalog-product is system-only');
  },
};

/** Stripe API snapshots keyed by Stripe object id; owner-scoped reads. */
const stripeOwnedSnapshotPolicy: AppVisibilityPolicy = {
  read: stripeOwnerScopedRead,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe snapshot entity is system-only');
  },
};

export const STRIPE_PATCH_DB_VISIBILITY_POLICIES: Readonly<
  Record<string, AppVisibilityPolicy>
> = {
  'stripe.catalog-price': stripeCatalogPricePolicy,
  'stripe.catalog-product': stripeCatalogProductPolicy,
  'stripe.customer': stripeOwnedSnapshotPolicy,
  'stripe.subscription': stripeSubscriptionPolicy,
  'stripe.payment-method': stripePaymentMethodPolicy,
  'stripe.invoice': stripeInvoicePolicy,
  'stripe.charge': stripeOwnedSnapshotPolicy,
  'stripe.payment-intent': stripeOwnedSnapshotPolicy,
  'stripe.setup-intent': stripeOwnedSnapshotPolicy,
  'stripe.refund': stripeOwnedSnapshotPolicy,
  'stripe.dispute': stripeOwnedSnapshotPolicy,
  'stripe.checkout-session': stripeOwnedSnapshotPolicy,
  'stripe.webhook-event': stripeWebhookEventPolicy,
};
