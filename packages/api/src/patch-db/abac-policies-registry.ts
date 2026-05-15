import {
  ACCOUNT_ENTITY_TYPE,
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountAttr,
  AccountProviderAttr,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@gamezilla/auth/shared';
import { CLIENT_CONFIG_ENTITY_TYPE } from '@gamezilla/client-config/shared/client-config-entities';
import {
  CHESS_PUZZLE_ENTITY_TYPE,
  CHESS_PUZZLE_LOAD_ENTITY_TYPE,
} from '@gamezilla/chess/shared/chess-puzzle-entities';
import { CHESS_PUZZLE_INTERACTION_ENTITY_TYPE } from '@gamezilla/chess/shared/chess-puzzle-interaction-entities';
import { CHESS_PUZZLE_PROFILE_ENTITY_TYPE } from '@gamezilla/chess/shared/chess-puzzle-profile-entities';
import { PROFILE_ENTITY_TYPE } from '@gamezilla/profile/shared/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceAttr,
  SpaceMembershipAttr,
} from '@gamezilla/spaces/shared/space-entities';
import { memberOfSpaceIdsFromContext } from '@gamezilla/spaces/server/space-auth-claim';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import type { PatchDbQueryWhereClause } from '@gamezilla/patch-db/interface';
import {
  isPatchDbSystemContext,
  READ_WHERE_ALWAYS_TRUE,
  READ_WHERE_NEVER_TRUE,
} from '@gamezilla/patch-db/interface';
import type { VisibilityPolicy } from '@gamezilla/patch-db/policy/visibility-policy-registry';

import {
  AbacEntityAttr,
  ChatMessageAttr,
  FriendRequestAttr,
  FriendshipAttr,
  MatchAttr,
} from './abac-patch-attrs';
import {
  appAuthFromWriteContext,
  assertCreatedByMatchesAuthor,
  authOnlyRead,
  type AppAuthContext,
} from './abac-policies-context';
import { rejectAccountSessionClientWrite } from '@gamezilla/auth/server/account-session-client-revoke';
import { STRIPE_PATCH_DB_VISIBILITY_POLICIES } from '@gamezilla/stripe/abac-policies';

type AppVisibilityPolicy = VisibilityPolicy<AppAuthContext>;

const devicePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => ({
    type: '=',
    attribute: DeviceAttr.id.key,
    value: ctx.deviceId,
  })),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
    const id = patch.attributes[DeviceAttr.id.key];
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
      attribute: AccountAttr.id.key,
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
    const id = patch.attributes[AccountAttr.id.key];
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
      attribute: AccountSessionAttr.deviceId.key,
      value: ctx.deviceId,
    };
  }),
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    rejectAccountSessionClientWrite();
  },
};

const accountProviderPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: AccountProviderAttr.accountId.key,
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
    const aid = patch.attributes[AccountProviderAttr.accountId.key];
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

const chessPuzzlePolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('chess.puzzle is system-only');
  },
};

const chessPuzzleLoadPolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('chess.puzzle.load is system-only');
  },
};

const chessPuzzleProfilePolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('chess.puzzle.profile requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
    const owner = patch.attributes[AbacEntityAttr.owner.key];
    if (owner !== undefined && owner !== appCtx.accountId) {
      throw new ForbiddenError('entity/owner mismatch');
    }
    if (patch.entityId !== appCtx.accountId) {
      throw new ForbiddenError('chess.puzzle.profile entityId mismatch', {
        expected: appCtx.accountId,
        actual: patch.entityId,
      });
    }
  },
};

const chessPuzzleInteractionPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((ctx) => {
    if (ctx.accountId === null) return READ_WHERE_NEVER_TRUE;
    return {
      type: '=',
      attribute: AbacEntityAttr.owner.key,
      value: ctx.accountId,
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    if (appCtx.accountId === null) {
      throw new ForbiddenError('chess.puzzle.interaction requires sign-in');
    }
    assertCreatedByMatchesAuthor(appCtx, patch);
    const owner = patch.attributes[AbacEntityAttr.owner.key];
    if (owner !== undefined && owner !== appCtx.accountId) {
      throw new ForbiddenError('entity/owner mismatch');
    }
  },
};

const adminMetricPolicy: AppVisibilityPolicy = {
  read: () => READ_WHERE_ALWAYS_TRUE,
  write: async (ctx) => {
    if (isPatchDbSystemContext(ctx)) return;
    throw new ForbiddenError('admin.metric is system-only');
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
      attribute: AbacEntityAttr.owner.key,
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
    const owner = patch.attributes[AbacEntityAttr.owner.key];
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
        { type: '=', attribute: SpaceAttr.hostId.key, value: ctx.myId },
        { type: '=', attribute: AbacEntityAttr.owner.key, value: ctx.myId },
        /** Browse live spaces (lobby / join UX). */
        { type: 'not_exists', attribute: SpaceAttr.endedAt.key },
      ],
    })
  ),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
    const hostId = patch.attributes[SpaceAttr.hostId.key];
    const owner = patch.attributes[AbacEntityAttr.owner.key];

    const isHost = typeof hostId === 'string' && hostId === appCtx.myId;
    const isOwner = typeof owner === 'string' && owner === appCtx.myId;
    if (!isHost && !isOwner) {
      throw new ForbiddenError('space write denied');
    }
  },
};

const spaceMembershipPolicy: AppVisibilityPolicy = {
  read: authOnlyRead((auth, ctx): PatchDbQueryWhereClause => {
    const spaceIds = memberOfSpaceIdsFromContext(ctx);
    if (spaceIds.length === 0) {
      return {
        type: '=',
        attribute: SpaceMembershipAttr.guestId.key,
        value: auth.myId,
      };
    }
    return {
      type: 'or',
      clauses: [
        {
          type: '=',
          attribute: SpaceMembershipAttr.guestId.key,
          value: auth.myId,
        },
        {
          type: 'in',
          attribute: SpaceMembershipAttr.spaceId.key,
          values: [...spaceIds],
        },
      ],
    };
  }),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
    const gid = patch.attributes[SpaceMembershipAttr.guestId.key];
    if (gid !== undefined && gid !== null && gid !== appCtx.myId) {
      throw new ForbiddenError('spaceMembership guestId mismatch');
    }
  },
};

const chatMessagePolicy: AppVisibilityPolicy = {
  read: authOnlyRead((auth, ctx): PatchDbQueryWhereClause => {
    if (auth.accountId === null) return READ_WHERE_NEVER_TRUE;
    const spaceIds = memberOfSpaceIdsFromContext(ctx);
    if (spaceIds.length === 0) {
      return {
        type: '=',
        attribute: ChatMessageAttr.spaceId.key,
        value: '__patchdb_none__',
      };
    }
    return {
      type: 'in',
      attribute: ChatMessageAttr.spaceId.key,
      values: [...spaceIds],
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
    const sid = patch.attributes[ChatMessageAttr.spaceId.key];
    const spaceIds = memberOfSpaceIdsFromContext(ctx);
    if (typeof sid !== 'string' || !spaceIds.includes(sid)) {
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
          attribute: FriendshipAttr.fromUserId.key,
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: FriendshipAttr.toUserId.key,
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
    const from = patch.attributes[FriendshipAttr.fromUserId.key];
    const to = patch.attributes[FriendshipAttr.toUserId.key];
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
          attribute: FriendRequestAttr.fromUserId.key,
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: FriendRequestAttr.toUserId.key,
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
          attribute: MatchAttr.participantUserIds.key,
          value: ctx.accountId,
        },
        {
          type: '=',
          attribute: AbacEntityAttr.owner.key,
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
      attribute: AbacEntityAttr.owner.key,
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

/**
 * Patch-db-example playground (Settings → Developer → Todos): authenticated
 * readers see every list / item. We can't snapshot-filter by
 * `patch/created-by-id` because {@link PATCH_META_KEYS} strips it from
 * snapshots, and the example never stamps {@link AbacEntityAttr.owner}.
 * Writes still require auth and must match the writer (Stamper sets
 * `patch/created-by-id`; we re-assert via {@link assertCreatedByMatchesAuthor}).
 */
const todoListPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(() => READ_WHERE_ALWAYS_TRUE),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
    assertCreatedByMatchesAuthor(appCtx, patch);
  },
};

const todoListItemPolicy: AppVisibilityPolicy = {
  read: authOnlyRead(() => READ_WHERE_ALWAYS_TRUE),
  write: async (ctx, patch, _tx) => {
    if (isPatchDbSystemContext(ctx)) return;
    const appCtx = appAuthFromWriteContext(ctx);
    if (appCtx === null) return;
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
  [CHESS_PUZZLE_ENTITY_TYPE]: chessPuzzlePolicy,
  [CHESS_PUZZLE_LOAD_ENTITY_TYPE]: chessPuzzleLoadPolicy,
  [CHESS_PUZZLE_PROFILE_ENTITY_TYPE]: chessPuzzleProfilePolicy,
  [CHESS_PUZZLE_INTERACTION_ENTITY_TYPE]: chessPuzzleInteractionPolicy,
  'admin.metric': adminMetricPolicy,
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
  'todo-list': todoListPolicy,
  'todo-list-item': todoListItemPolicy,
  ...STRIPE_PATCH_DB_VISIBILITY_POLICIES,
};
