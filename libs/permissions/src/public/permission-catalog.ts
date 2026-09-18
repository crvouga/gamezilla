import { defineCatalog } from '@pkgs/permissions';

/** Every boolean capability the product asks about. */
export const PERMISSION = defineCatalog({
  friendsUse: 'friends:use',
  peopleSearch: 'people:search',
  notificationsReceive: 'notifications:receive',
  devicesManage: 'devices:manage',
  billingSubscribe: 'billing:subscribe',
  billingManage: 'billing:manage',
  matchmakingUse: 'matchmaking:use',
  puzzlesPlay: 'puzzles:play',
  puzzlesCustomizeFeed: 'puzzles:customize-feed',
  spacesCreate: 'spaces:create',
  spacesJoin: 'spaces:join',
  spacesWatch: 'spaces:watch',
  spacesLeave: 'spaces:leave',
  spacesRename: 'spaces:rename',
  spacesEnd: 'spaces:end',
  spacesSetVisibility: 'spaces:set-visibility',
  spacesManageMembers: 'spaces:manage-members',
  spacesSelectGame: 'spaces:select-game',
});
export type AppPermission = (typeof PERMISSION)[keyof typeof PERMISSION];

/** Every counted cap the product evaluates against usage. */
export const LIMIT = defineCatalog({
  puzzlesPerDay: 'puzzles:per-day',
  hostedSpaces: 'spaces:hosted',
});
export type AppLimit = (typeof LIMIT)[keyof typeof LIMIT];

/** Every role a subject can hold: plan roles, then per-space presence roles. */
export const ROLE = defineCatalog({
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
