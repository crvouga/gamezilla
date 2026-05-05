import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/domain/auth';
import { CLIENT_CONFIG_ENTITY_TYPE } from '@gamezilla/domain/client-config/client-config-entities';
import { PROFILE_ENTITY_TYPE } from '@gamezilla/domain/profile/profile-entities';
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
  PATCH_CREATED_BY_ID,
  PATCH_CREATED_BY_LEGACY,
  READ_WHERE_ALWAYS_TRUE,
  READ_WHERE_NEVER_TRUE,
} from '@gamezilla/patch-db/interface';
import { PATCH_DB_SYSTEM_DEVICE_ID } from '@gamezilla/patch-db/policy/system-device';
import type {
  VisibilityPolicy,
  VisibilityPolicyReadContext,
} from '@gamezilla/patch-db/policy/visibility-policy-registry';

import { assertAccountSessionClientRevokeOnly } from './account-session-client-revoke';

/**
 * Gamezilla-specific auth context: extends the generic patch-db auth context
 * with the claims needed by our visibility policies. The session middleware is
 * responsible for producing contexts of this shape.
 */
export type AppAuthContext = PatchDbAuthContext & {
  /** Signed-in account id, or `null` when anonymous (`x-anon-id`). */
  readonly accountId: string | null;
  /** Profile / space author id: `accountId` when signed in, else install id. */
  readonly myId: string;
  readonly memberOfSpaceIds: readonly string[];
  readonly friendUserIds: readonly string[];
  readonly blockedUserIds: readonly string[];
};

export type AppClientContext = {
  readonly clientId: string;
  readonly deviceId?: undefined;
};

type AppVisibilityPolicy = VisibilityPolicy<AppAuthContext>;
type AppReadContext = VisibilityPolicyReadContext<AppAuthContext>;

/**
 * Wraps an authenticated-only read function so it can be assigned directly to
 * `VisibilityPolicy.read`. Unauthenticated clients get {@link READ_WHERE_NEVER_TRUE} (no
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

/** Client-only writes skip the auth branch; session middleware always uses {@link AppAuthContext}. */
function appAuthFromWriteContext(ctx: PatchDbContext): AppAuthContext | null {
  if (!isPatchDbAuthContext(ctx)) return null;
  return ctx as AppAuthContext;
}

function createdBy(patch: PatchInput): string {
  const raw = patch as Record<string, unknown>;
  const top =
    typeof raw['createdBy'] === 'string' ? (raw['createdBy'] as string) : '';
  const attr =
    patch.attributes[PATCH_CREATED_BY_ID] ??
    patch.attributes[PATCH_CREATED_BY_LEGACY];
  const fromAttr = typeof attr === 'string' ? attr : '';
  return top || fromAttr;
}

function assertCreatedByMatchesAuthor(
  ctx: PatchDbAuthContext,
  patch: PatchInput
): void {
  const app = ctx as AppAuthContext;
  const cb = createdBy(patch);
  if (cb !== app.myId && cb !== PATCH_DB_SYSTEM_DEVICE_ID) {
    throw new ForbiddenError('patch/createdById must match author', {
      expected: app.myId,
      actual: cb,
    });
  }
}

const devicePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: DeviceAttr.id,
    value: ctx.deviceId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
    const id = patch.attributes[DeviceAttr.id];
    if (typeof id === 'string' && id !== appCtx.deviceId) {
      throw new ForbiddenError('device id mismatch', { id });
    }
  },
};

const accountPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: AccountAttr.id,
      value: ctx.accountId,
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('account writes require sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
    const id = patch.attributes[AccountAttr.id];
    if (typeof id === 'string' && id !== appCtx.accountId) {
      throw new ForbiddenError('account id mismatch', { id });
    }
  },
};

const accountSessionPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: AccountSessionAttr.deviceId,
      value: ctx.deviceId,
    };
  }),
  write: async (ctx, patch, tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) {
      throw new ForbiddenError('accountSession is system-managed');
    }
    if (appCtx.accountId === null) {
      throw new ForbiddenError('accountSession requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
    await assertAccountSessionClientRevokeOnly({
      deviceId: appCtx.deviceId,
      accountId: appCtx.accountId,
      patch,
      tx,
    });
  },
};

const accountProviderPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: AccountProviderAttr.accountId,
      value: ctx.accountId,
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('accountProvider requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
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
    assertCreatedByMatchesAuthor(appCtx, patch);
    if (patch.entityId !== appCtx.myId) {
      throw new ForbiddenError('profile entityId mismatch', {
        expected: appCtx.myId,
        actual: patch.entityId,
      });
    }
  },
};

const profilePrivatePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: 'entity/owner',
      value: ctx.accountId,
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('profile.private requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
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
        { type: '=', attribute: SpaceAttr.hostId, value: ctx.myId },
        { type: '=', attribute: 'entity/owner', value: ctx.myId },
        /** Browse live spaces (lobby / join UX). */
        { type: 'not_exists', attribute: SpaceAttr.endedAt },
      ],
    })
  ),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
    const hostId = patch.attributes[SpaceAttr.hostId];
    const owner = patch.attributes['entity/owner'];
    const isHost = typeof hostId === 'string' && hostId === appCtx.myId;
    const isOwner = typeof owner === 'string' && owner === appCtx.myId;
    if (!isHost && !isOwner) {
      throw new ForbiddenError('space write denied');
    }
  },
};

const spaceMembershipPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.memberOfSpaceIds.length === 0) {
      return {
        type: '=',
        attribute: SpaceMembershipAttr.guestId,
        value: ctx.myId,
      };
    }
    return {
      type: 'or',
      clauses: [
        {
          type: '=',
          attribute: SpaceMembershipAttr.guestId,
          value: ctx.myId,
        },
        {
          type: 'in',
          attribute: SpaceMembershipAttr.spaceId,
          values: [...ctx.memberOfSpaceIds],
        },
      ],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
    const gid = patch.attributes[SpaceMembershipAttr.guestId];
    if (gid !== undefined && gid !== null && gid !== appCtx.myId) {
      throw new ForbiddenError('spaceMembership guestId mismatch');
    }
  },
};

const chatMessagePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
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
    if (appCtx.accountId === null) {
      throw new ForbiddenError('chat.message requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
    const sid = patch.attributes['chat.message/spaceId'];
    if (typeof sid !== 'string' || !appCtx.memberOfSpaceIds.includes(sid)) {
      throw new ForbiddenError('chat.message space membership required');
    }
  },
};

const friendshipPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: 'or',
      clauses: [
        {
          type: '=',
          attribute: 'friendship/fromUserId',
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: 'friendship/toUserId',
          value: ctx.accountId,
        },
      ],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('friendship requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
    const from = patch.attributes['friendship/fromUserId'];
    const to = patch.attributes['friendship/toUserId'];
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
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: 'or',
      clauses: [
        {
          type: '=',
          attribute: 'friend.request/fromUserId',
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: 'friend.request/toUserId',
          value: ctx.accountId,
        },
      ],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('friend.request requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
  },
};

const matchPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx): PatchDbQueryWhereClause => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: 'or',
      clauses: [
        {
          type: 'contains',
          attribute: 'match/participantUserIds',
          value: ctx.accountId,
        },
        { type: '=', attribute: 'entity/owner', value: ctx.accountId },
      ],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('match requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
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
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: 'entity/owner',
      value: ctx.accountId,
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('inventory.item requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
  },
};

const stripeOwnerScopedRead = authOnlyRead((ctx): PatchDbQueryWhereClause => {
  if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
  return {
    type: '=',
    attribute: 'entity/owner',
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
  [DEVICE_ENTITY_TYPE]: devicePolicy,
  [ACCOUNT_ENTITY_TYPE]: accountPolicy,
  [ACCOUNT_SESSION_ENTITY_TYPE]: accountSessionPolicy,
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
