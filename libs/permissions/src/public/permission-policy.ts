import { definePolicy, type PermissionPolicy } from '@pkgs/permissions';

import {
  type AppLimit,
  type AppPermission,
  LIMIT,
  PERMISSION,
  ROLE,
} from './permission-catalog';

/**
 * v1 entitlements. Plans are listed explicitly — no plan-role inheritance — so
 * `plan:paid` can lack `billing:subscribe` while holding every other free
 * grant.
 */
export const DEFAULT_PERMISSION_POLICY: PermissionPolicy<
  AppPermission,
  AppLimit
> = definePolicy<AppPermission, AppLimit>({
  roles: {
    [ROLE.planGuest]: {
      permissions: [
        PERMISSION.puzzlesPlay,
        PERMISSION.spacesCreate,
        PERMISSION.spacesJoin,
        PERMISSION.spacesWatch,
      ],
      limits: { [LIMIT.puzzlesPerDay]: 20, [LIMIT.hostedSpaces]: null },
    },
    [ROLE.planFree]: {
      permissions: [
        PERMISSION.friendsUse,
        PERMISSION.peopleSearch,
        PERMISSION.notificationsReceive,
        PERMISSION.devicesManage,
        PERMISSION.billingSubscribe,
        PERMISSION.billingManage,
        PERMISSION.matchmakingUse,
        PERMISSION.puzzlesPlay,
        PERMISSION.puzzlesCustomizeFeed,
        PERMISSION.spacesCreate,
        PERMISSION.spacesJoin,
        PERMISSION.spacesWatch,
      ],
      limits: { [LIMIT.puzzlesPerDay]: null, [LIMIT.hostedSpaces]: 1 },
    },
    [ROLE.planPaid]: {
      permissions: [
        PERMISSION.friendsUse,
        PERMISSION.peopleSearch,
        PERMISSION.notificationsReceive,
        PERMISSION.devicesManage,
        PERMISSION.billingManage,
        PERMISSION.matchmakingUse,
        PERMISSION.puzzlesPlay,
        PERMISSION.puzzlesCustomizeFeed,
        PERMISSION.spacesCreate,
        PERMISSION.spacesJoin,
        PERMISSION.spacesWatch,
      ],
      limits: { [LIMIT.puzzlesPerDay]: null, [LIMIT.hostedSpaces]: null },
    },
    [ROLE.spaceMember]: {
      permissions: [PERMISSION.spacesWatch, PERMISSION.spacesLeave],
    },
    [ROLE.spaceHost]: {
      grants: [ROLE.spaceMember],
      permissions: [
        PERMISSION.spacesRename,
        PERMISSION.spacesEnd,
        PERMISSION.spacesSetVisibility,
        PERMISSION.spacesManageMembers,
        PERMISSION.spacesSelectGame,
      ],
    },
  },
});
