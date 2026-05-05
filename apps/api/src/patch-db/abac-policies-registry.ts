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
import type { PatchDbQueryWhereClause } from '@gamezilla/patch-db/interface';
import {
  isPatchDbSystemContext,
  READ_WHERE_ALWAYS_TRUE,
  READ_WHERE_NEVER_TRUE,
} from '@gamezilla/patch-db/interface';
import type { VisibilityPolicy } from '@gamezilla/patch-db/policy/visibility-policy-registry';

import {
  assertCreatedByMatchesAuthor,
  authOnlyRead,
  appAuthFromWriteContext,
  type AppAuthContext,
} from './abac-policies-context';
import { STRIPE_PATCH_DB_VISIBILITY_POLICIES } from './abac-policies-registry-stripe';
import { assertAccountSessionClientRevokeOnly } from './account-session-client-revoke';

type AppVisibilityPolicy = VisibilityPolicy<AppAuthContext>;

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
  ...STRIPE_PATCH_DB_VISIBILITY_POLICIES,
};
