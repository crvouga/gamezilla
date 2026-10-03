import { defineCatalog } from '@pkgs/permissions';

/** Every boolean capability the product asks about. */
export const PERMISSION = defineCatalog({
  friendsUse: 'friends:use',
  peopleSearch: 'people:search',
  notificationsReceive: 'notifications:receive',
  profileDeleteAccount: 'profile:delete-account',
  profileExportData: 'profile:export-data',
  billingView: 'billing:view',
  billingSubscribe: 'billing:subscribe',
  billingManage: 'billing:manage',
  matchmakingUse: 'matchmaking:use',
  matchmakingView: 'matchmaking:view',
  matchmakingStop: 'matchmaking:stop',
  matchmakingChangeRange: 'matchmaking:change-range',
  chessMultiplayerPlay: 'chess:multiplayer-play',
  chessMultiplayerResign: 'chess:multiplayer-resign',
  puzzlesPlay: 'puzzles:play',
  puzzlesCustomizeFeed: 'puzzles:customize-feed',
  spacesCreate: 'spaces:create',
  spacesJoin: 'spaces:join',
  spacesLeave: 'spaces:leave',
  spacesRename: 'spaces:rename',
  spacesEnd: 'spaces:end',
  spacesManageMembers: 'spaces:manage-members',
  spacesSelectGame: 'spaces:select-game',
});
export type AppPermission = (typeof PERMISSION)[keyof typeof PERMISSION];

/** Every counted cap the product evaluates against usage. */
export const LIMIT = defineCatalog({
  hostedSpaces: 'spaces:hosted',
  unfinishedMultiplayerGames: 'chess:unfinished-multiplayer-games',
});
export type AppLimit = (typeof LIMIT)[keyof typeof LIMIT];

/**
 * Catalogued `domain.verb` actions (§22.7). Feature code gates only through
 * these constants, so a typo'd action fails type-checking. (Pre-existing
 * colon-form `PERMISSION` ids stay as they are; both are policy keys.)
 */
export const ACTION = defineCatalog({
  puzzleRatedSolve: 'puzzle.rated.solve',
});
export type AppAction = (typeof ACTION)[keyof typeof ACTION];

/** Actions that are consumed (quotas) rather than merely granted. */
export const QUOTA_ACTIONS = [ACTION.puzzleRatedSolve] as const;
export type AppQuota = (typeof QUOTA_ACTIONS)[number];

/** Every key a policy role may list under `permissions`. */
export type AppPolicyKey = AppPermission | AppAction;

/** Every key that is granted (decided), not consumed. */
export type AppGrantKey = Exclude<AppPolicyKey, AppQuota>;

export function isQuotaAction(action: string): action is AppQuota {
  return (QUOTA_ACTIONS as readonly string[]).includes(action);
}

/**
 * Every role a subject can hold. Roles are policy data: the baseline and plan
 * roles are assigned by their `when` fact predicates (`resolveSubject`), the
 * space roles by presence. Private to this package: nothing outside it names
 * a role, so no caller can branch on one.
 */
export const ROLE = defineCatalog({
  baseline: 'baseline',
  planGuest: 'plan:guest',
  planFree: 'plan:free',
  planPaid: 'plan:paid',
  spaceMember: 'space:member',
  spaceHost: 'space:host',
});
export type AppRole = (typeof ROLE)[keyof typeof ROLE];
export type PlanRole =
  | typeof ROLE.planGuest
  | typeof ROLE.planFree
  | typeof ROLE.planPaid;
export type SpacePresenceRole = 'host' | 'guest';
