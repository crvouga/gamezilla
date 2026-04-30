import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  PRINCIPAL_ENTITY_TYPE,
  PRINCIPAL_SESSION_ENTITY_TYPE,
  PrincipalAttr,
  PrincipalSessionAttr,
} from '@gamezilla/domain/auth';
import { ProfileAttr, PROFILE_ENTITY_TYPE } from '@gamezilla/domain/profile/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { ForbiddenError } from '../forbidden-error';
import type {
  PatchInput,
  PatchesDbAuthContext,
  PatchesDbContext,
  PatchesDbQueryWhereClause,
} from '../interface';
import {
  isPatchesDbAuthContext,
  isPatchesDbSystemContext,
  READ_WHERE_ALWAYS_TRUE,
} from '../interface';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from './system-principal';
import type { VisibilityPolicy } from './visibility-policy-registry';

function requireAuth(
  ctx: PatchesDbContext
): asserts ctx is PatchesDbAuthContext {
  if (!isPatchesDbAuthContext(ctx)) {
    throw new ForbiddenError('authentication required', { ctx });
  }
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
  ctx: PatchesDbAuthContext,
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

const principalPolicy: VisibilityPolicy = {
  read: (ctx) => ({
    type: '=',
    attribute: PrincipalAttr.id,
    value: ctx.principalId,
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const id = patch.attributes[PrincipalAttr.id];
    if (typeof id === 'string' && id !== ctx.principalId) {
      throw new ForbiddenError('principal id mismatch', { id });
    }
  },
};

const accountPolicy: VisibilityPolicy = {
  read: (ctx) => ({
    type: '=',
    attribute: AccountAttr.id,
    value: ctx.accountId,
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const id = patch.attributes[AccountAttr.id];
    if (typeof id === 'string' && id !== ctx.accountId) {
      throw new ForbiddenError('account id mismatch', { id });
    }
  },
};

const principalSessionPolicy: VisibilityPolicy = {
  read: (ctx) => ({
    type: '=',
    attribute: PrincipalSessionAttr.principalId,
    value: ctx.principalId,
  }),
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('principalSession is system-managed');
  },
};

const accountProviderPolicy: VisibilityPolicy = {
  read: (ctx) => ({
    type: '=',
    attribute: AccountProviderAttr.accountId,
    value: ctx.accountId,
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const aid = patch.attributes[AccountProviderAttr.accountId];
    if (typeof aid === 'string' && aid !== ctx.accountId) {
      throw new ForbiddenError('accountProvider accountId mismatch');
    }
  },
};

const adminMetricPolicy: VisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('admin/metric is system-only');
  },
};

const profilePolicy: VisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const pid = patch.attributes[ProfileAttr.id];
    if (typeof pid === 'string' && pid !== ctx.principalId) {
      throw new ForbiddenError('profile principal mismatch');
    }
    if (
      patch.entityId !== ctx.principalId &&
      patch.entityId !== ctx.accountId
    ) {
      throw new ForbiddenError('profile entity id mismatch');
    }
  },
};

const profilePrivatePolicy: VisibilityPolicy = {
  read: (ctx) => ({
    type: '=',
    attribute: 'entity/owner',
    value: ctx.accountId,
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const owner = patch.attributes['entity/owner'];
    if (owner !== undefined && owner !== ctx.accountId) {
      throw new ForbiddenError('entity/owner mismatch');
    }
  },
};

const spacePolicy: VisibilityPolicy = {
  read: (ctx): PatchesDbQueryWhereClause => ({
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
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const hostId = patch.attributes[SpaceAttr.hostId];
    const owner = patch.attributes['entity/owner'];
    const members = patch.attributes['space/memberAccountIds'];
    const isHost =
      typeof hostId === 'string' && hostId === ctx.principalId;
    const isOwner =
      typeof owner === 'string' && owner === ctx.accountId;
    const isMember =
      Array.isArray(members) && members.includes(ctx.accountId);
    if (!isHost && !isOwner && !isMember) {
      throw new ForbiddenError('space write denied');
    }
  },
};

const spaceMembershipPolicy: VisibilityPolicy = {
  read: (ctx): PatchesDbQueryWhereClause => {
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
  },
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
  },
};

const chatMessagePolicy: VisibilityPolicy = {
  read: (ctx): PatchesDbQueryWhereClause => {
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
  },
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const sid = patch.attributes['chat.message/spaceId'];
    if (
      typeof sid !== 'string' ||
      !ctx.memberOfSpaceIds.includes(sid)
    ) {
      throw new ForbiddenError('chat.message space membership required');
    }
  },
};

const friendshipPolicy: VisibilityPolicy = {
  read: (ctx): PatchesDbQueryWhereClause => ({
    type: 'or',
    clauses: [
      { type: '=', attribute: 'friendship/fromAccountId', value: ctx.accountId },
      { type: '=', attribute: 'friendship/toAccountId', value: ctx.accountId },
    ],
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
    const from = patch.attributes['friendship/fromAccountId'];
    const to = patch.attributes['friendship/toAccountId'];
    if (
      (typeof from === 'string' && from === ctx.accountId) ||
      (typeof to === 'string' && to === ctx.accountId)
    ) {
      return;
    }
    throw new ForbiddenError('friendship endpoint mismatch');
  },
};

const friendRequestPolicy: VisibilityPolicy = {
  read: (ctx): PatchesDbQueryWhereClause => ({
    type: 'or',
    clauses: [
      { type: '=', attribute: 'friend.request/fromAccountId', value: ctx.accountId },
      { type: '=', attribute: 'friend.request/toAccountId', value: ctx.accountId },
    ],
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
  },
};

const matchPolicy: VisibilityPolicy = {
  read: (ctx): PatchesDbQueryWhereClause => ({
    type: 'or',
    clauses: [
      { type: 'contains', attribute: 'match/participantAccountIds', value: ctx.accountId },
      { type: '=', attribute: 'entity/owner', value: ctx.accountId },
    ],
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
  },
};

const matchScorePolicy: VisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('match.score is system-only');
  },
};

const inventoryItemPolicy: VisibilityPolicy = {
  read: (ctx) => ({
    type: '=',
    attribute: 'entity/owner',
    value: ctx.accountId,
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    requireAuth(ctx);
    assertCreatedByMatchesPrincipal(ctx, patch);
  },
};

function stripeRead(ctx: PatchesDbAuthContext): PatchesDbQueryWhereClause {
  return {
    type: '=',
    attribute: 'entity/owner',
    value: ctx.accountId,
  };
}

const stripeSubscriptionPolicy: VisibilityPolicy = {
  read: stripeRead,
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.subscription is system-only');
  },
};

const stripePaymentMethodPolicy: VisibilityPolicy = {
  read: stripeRead,
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.paymentMethod is system-only');
  },
};

const stripeInvoicePolicy: VisibilityPolicy = {
  read: stripeRead,
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.invoice is system-only');
  },
};

const stripeWebhookEventPolicy: VisibilityPolicy = {
  read: stripeRead,
  write: async (ctx) => {
    if (isPatchesDbSystemContext(ctx)) return;
    throw new ForbiddenError('stripe.webhook_event is system-only');
  },
};

/** Domain + auth entity visibility (ABAC predicates). */
export const DEFAULT_PATCH_DB_VISIBILITY_POLICIES: Readonly<
  Record<string, VisibilityPolicy>
> = {
  [PRINCIPAL_ENTITY_TYPE]: principalPolicy,
  account: accountPolicy,
  [PRINCIPAL_SESSION_ENTITY_TYPE]: principalSessionPolicy,
  [ACCOUNT_PROVIDER_ENTITY_TYPE]: accountProviderPolicy,
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
  'stripe.subscription': stripeSubscriptionPolicy,
  'stripe.paymentMethod': stripePaymentMethodPolicy,
  'stripe.invoice': stripeInvoicePolicy,
  'stripe.webhook_event': stripeWebhookEventPolicy,
};
