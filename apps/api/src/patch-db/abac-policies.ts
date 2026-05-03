import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  PRINCIPAL_ENTITY_TYPE,
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalAttr,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import { CLIENT_CONFIG_ENTITY_TYPE } from '@gamezilla/domain/client-config/client-config-entities';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import type {
  PatchDbAuthContext,
  PatchDbContext,
  PatchDbQueryWhereClause,
  PatchInput,
} from '@gamezilla/patch-db/interface';
import {
  isPatchDbAuthContext,
  isPatchDbSystemContext,
  READ_WHERE_ALWAYS_TRUE,
  READ_WHERE_NEVER_TRUE,
} from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '@gamezilla/patch-db/policy/system-principal';
import type {
  VisibilityPolicy,
  VisibilityPolicyReadContext,
} from '@gamezilla/patch-db/policy/visibility-policy-registry';

/**
 * Gamezilla-specific auth context: extends the generic patch-db auth context
 * with the claims needed by our visibility policies. The session middleware is
 * responsible for producing contexts of this shape.
 */
export type AppAuthContext = PatchDbAuthContext & {
  readonly accountId: string;
  readonly memberOfSpaceIds: readonly string[];
  readonly friendAccountIds: readonly string[];
  readonly blockedAccountIds: readonly string[];
};

export type AppVisitorContext = {
  readonly visitorId: string;
  readonly principalId?: undefined;
};

type AppVisibilityPolicy = VisibilityPolicy<AppAuthContext>;
type AppReadContext = VisibilityPolicyReadContext<AppAuthContext>;

/**
 * Wraps an authenticated-only read function so it can be assigned directly to
 * `VisibilityPolicy.read`. Visitors get {@link READ_WHERE_NEVER_TRUE} (no
 * rows) without each policy repeating the narrowing check.
 */
function authOnlyRead(
  fn: (ctx: AppAuthContext) => PatchDbQueryWhereClause
): (ctx: AppReadContext) => PatchDbQueryWhereClause {
  return (ctx) =>
    isPatchDbAuthContext(ctx)
      ? fn(ctx as AppAuthContext)
      : READ_WHERE_NEVER_TRUE;
}

/** Visitor writes skip the auth branch; session middleware always uses {@link AppAuthContext}. */
function appAuthFromWriteContext(ctx: PatchDbContext): AppAuthContext | null {
  if (!isPatchDbAuthContext(ctx)) return null;
  return ctx as AppAuthContext;
}

function createdBy(patch: PatchInput): string {
  const raw = patch as Record<string, unknown>;
  const top =
    typeof raw['createdBy'] === 'string' ? (raw['createdBy'] as string) : '';
  const attr = patch.attributes['patch/createdBy'];
  const fromAttr = typeof attr === 'string' ? attr : '';
  return top || fromAttr;
}

function assertCreatedByMatchesPrincipal(
  ctx: PatchDbAuthContext,
  patch: PatchInput
): void {
  const cb = createdBy(patch);
  if (cb !== ctx.principalId && cb !== PATCH_DB_SYSTEM_PRINCIPAL_ID) {
    throw new ForbiddenError('patch/createdBy must match principal', {
      expected: ctx.principalId,
      actual: cb,
    });
  }
}

const principalPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: PrincipalAttr.id,
    value: ctx.principalId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const id = patch.attributes[PrincipalAttr.id];
    if (typeof id === 'string' && id !== appCtx.principalId) {
      throw new ForbiddenError('principal id mismatch', { id });
    }
  },
};

const accountPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: AccountAttr.id,
    value: ctx.accountId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const id = patch.attributes[AccountAttr.id];
    if (typeof id === 'string' && id !== appCtx.accountId) {
      throw new ForbiddenError('account id mismatch', { id });
    }
  },
};

const principalSessionPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: PrincipalSessionAttr.principalId,
    value: ctx.principalId,
  })),
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('principalSession is system-managed');
  },
};

const accountProviderPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: AccountProviderAttr.accountId,
    value: ctx.accountId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const aid = patch.attributes[AccountProviderAttr.accountId];
    if (typeof aid === 'string' && aid !== appCtx.accountId) {
      throw new ForbiddenError('accountProvider accountId mismatch');
    }
  },
};

const clientConfigPolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('clientConfig is system-only');
  },
};

const adminMetricPolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('admin/metric is system-only');
  },
};

const profilePolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const pid = patch.attributes[ProfileAttr.id];
    if (typeof pid === 'string' && pid !== appCtx.principalId) {
      throw new ForbiddenError('profile principal mismatch');
    }
    if (
      patch.entityId !== appCtx.principalId &&
      patch.entityId !== appCtx.accountId
    ) {
      throw new ForbiddenError('profile entity id mismatch');
    }
  },
};

const profilePrivatePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: 'entity/owner',
    value: ctx.accountId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const owner = patch.attributes['entity/owner'];
    if (owner !== undefined && owner !== appCtx.accountId) {
      throw new ForbiddenError('entity/owner mismatch');
    }
  },
};

const spacePolicy: AppVisibilityPolicy = {
  read: authOnlyRead(
    (ctx): PatchDbQueryWhereClause => ({
      type: 'or',
      clauses: [
        { type: '=', attribute: SpaceAttr.hostId, value: ctx.principalId },
        { type: '=', attribute: 'entity/owner', value: ctx.accountId },
        {
          type: 'contains',
          attribute: 'space/memberAccountIds',
          value: ctx.accountId,
        },
      ],
    })
  ),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const hostId = patch.attributes[SpaceAttr.hostId];
    const owner = patch.attributes['entity/owner'];
    const members = patch.attributes['space/memberAccountIds'];
    const isHost = typeof hostId === 'string' && hostId === appCtx.principalId;
    const isOwner = typeof owner === 'string' && owner === appCtx.accountId;
    const isMember =
      Array.isArray(members) && members.includes(appCtx.accountId);
    if (!isHost && !isOwner && !isMember) {
      throw new ForbiddenError('space write denied');
    }
  },
};

const spaceMembershipPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.memberOfSpaceIds.length === 0) {
      return {
        type: '=',
        attribute: SpaceMembershipAttr.spaceId,
        value: '__patchdb_none__',
      };
    }
    return {
      type: 'in',
      attribute: SpaceMembershipAttr.spaceId,
      values: [...ctx.memberOfSpaceIds],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
  },
};

const chatMessagePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.memberOfSpaceIds.length === 0) {
      return {
        type: '=',
        attribute: 'chat.message/spaceId',
        value: '__patchdb_none__',
      };
    }
    return {
      type: 'in',
      attribute: 'chat.message/spaceId',
      values: [...ctx.memberOfSpaceIds],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const sid = patch.attributes['chat.message/spaceId'];
    if (typeof sid !== 'string' || !appCtx.memberOfSpaceIds.includes(sid)) {
      throw new ForbiddenError('chat.message space membership required');
    }
  },
};

const friendshipPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(
    (ctx): PatchDbQueryWhereClause => ({
      type: 'or',
      clauses: [
        {
          type: '=',
          attribute: 'friendship/fromAccountId',
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: 'friendship/toAccountId',
          value: ctx.accountId,
        },
      ],
    })
  ),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
    const from = patch.attributes['friendship/fromAccountId'];
    const to = patch.attributes['friendship/toAccountId'];
    if (
      (typeof from === 'string' && from === appCtx.accountId) ||
      (typeof to === 'string' && to === appCtx.accountId)
    ) {
      return;
    }
    throw new ForbiddenError('friendship endpoint mismatch');
  },
};

const friendRequestPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(
    (ctx): PatchDbQueryWhereClause => ({
      type: 'or',
      clauses: [
        {
          type: '=',
          attribute: 'friend.request/fromAccountId',
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: 'friend.request/toAccountId',
          value: ctx.accountId,
        },
      ],
    })
  ),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
  },
};

const matchPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(
    (ctx): PatchDbQueryWhereClause => ({
      type: 'or',
      clauses: [
        {
          type: 'contains',
          attribute: 'match/participantAccountIds',
          value: ctx.accountId,
        },
        { type: '=', attribute: 'entity/owner', value: ctx.accountId },
      ],
    })
  ),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
  },
};

const matchScorePolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('match.score is system-only');
  },
};

const inventoryItemPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: 'entity/owner',
    value: ctx.accountId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesPrincipal(appCtx, patch);
  },
};

const stripeOwnerScopedRead = authOnlyRead(
  (ctx): PatchDbQueryWhereClause => ({
    type: '=',
    attribute: 'entity/owner',
    value: ctx.accountId,
  })
);

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
    throw new ForbiddenError('stripe.paymentMethod is system-only');
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
    throw new ForbiddenError('stripe.webhook_event is system-only');
  },
};

/** Catalog rows are global; any authenticated caller may read for checkout. */
const stripeCatalogPricePolicy: AppVisibilityPolicy = {
  read: authOnlyRead(() => READ_WHERE_ALWAYS_TRUE),
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.catalog_price is system-only');
  },
};

const stripeCatalogProductPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(() => READ_WHERE_ALWAYS_TRUE),
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.catalog_product is system-only');
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

/** Domain + auth entity visibility (ABAC predicates). */
export const DEFAULT_PATCH_DB_VISIBILITY_POLICIES: Readonly<
  Record<string, AppVisibilityPolicy>
> = {
  [PRINCIPAL_ENTITY_TYPE]: principalPolicy,
  account: accountPolicy,
  [PRINCIPAL_SESSION_ENTITY_TYPE]: principalSessionPolicy,
  [ACCOUNT_PROVIDER_ENTITY_TYPE]: accountProviderPolicy,
  [CLIENT_CONFIG_ENTITY_TYPE]: clientConfigPolicy,
  'admin/metric': adminMetricPolicy,
  [PROFILE_ENTITY_TYPE]: profilePolicy,
  'profile.private': profilePrivatePolicy,
  [SPACE_ENTITY_TYPE]: spacePolicy,
  [SPACE_MEMBERSHIP_ENTITY_TYPE]: spaceMembershipPolicy,
  'chat.message': chatMessagePolicy,
  friendship: friendshipPolicy,
  'friend.request': friendRequestPolicy,
  match: matchPolicy,
  'match.score': matchScorePolicy,
  'inventory.item': inventoryItemPolicy,
  'stripe.catalog_price': stripeCatalogPricePolicy,
  'stripe.catalog_product': stripeCatalogProductPolicy,
  'stripe.customer': stripeOwnedSnapshotPolicy,
  'stripe.subscription': stripeSubscriptionPolicy,
  'stripe.paymentMethod': stripePaymentMethodPolicy,
  'stripe.invoice': stripeInvoicePolicy,
  'stripe.charge': stripeOwnedSnapshotPolicy,
  'stripe.payment_intent': stripeOwnedSnapshotPolicy,
  'stripe.setup_intent': stripeOwnedSnapshotPolicy,
  'stripe.refund': stripeOwnedSnapshotPolicy,
  'stripe.dispute': stripeOwnedSnapshotPolicy,
  'stripe.checkout_session': stripeOwnedSnapshotPolicy,
  'stripe.webhook_event': stripeWebhookEventPolicy,
};
