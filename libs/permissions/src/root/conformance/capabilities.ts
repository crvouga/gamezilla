/**
 * The product's capabilities, as the conformance manifest names them, mapped
 * onto the permission catalog's keys. This is the one translation between the
 * specs' words and the permission system's identifiers: the decision-table
 * bindings read it to know which key a case asks about, and the closed-world
 * tests hold it to exactly the manifest on one side and exactly the catalog on
 * the other.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import {
  ACTION,
  type AppGrantKey,
  type AppLimit,
  type AppPolicyKey,
  isQuotaAction,
  LIMIT,
  PERMISSION,
} from '../../shared/permission-catalog';

/** Everything the permission system decides about, by kind. */
export type CatalogKey = AppPolicyKey | AppLimit;

/** Manifest capability id → the catalog key the product decides it with. */
export const CAPABILITY_KEYS = {
  'keep a friends list': PERMISSION.friendsUse,
  'use people search': PERMISSION.peopleSearch,
  'get notifications': PERMISSION.notificationsReceive,
  'delete their account': PERMISSION.profileDeleteAccount,
  'take a personal-data export': PERMISSION.profileExportData,
  'see the billing plans': PERMISSION.billingView,
  subscribe: PERMISSION.billingSubscribe,
  'use the billing portal': PERMISSION.billingManage,
  'wait for a match': PERMISSION.matchmakingUse,
  'see their matchmaking wait': PERMISSION.matchmakingView,
  'stop waiting for a match': PERMISSION.matchmakingStop,
  'change their matchmaking range': PERMISSION.matchmakingChangeRange,
  'play multiplayer chess': PERMISSION.chessMultiplayerPlay,
  'resign multiplayer chess': PERMISSION.chessMultiplayerResign,
  'start another multiplayer game': LIMIT.unfinishedMultiplayerGames,
  'play puzzles': PERMISSION.puzzlesPlay,
  'customize the puzzle feed': PERMISSION.puzzlesCustomizeFeed,
  'start a rated puzzle': ACTION.puzzleRatedSolve,
  'create a space': PERMISSION.spacesCreate,
  'join a space': PERMISSION.spacesJoin,
  'host another open space': LIMIT.hostedSpaces,
  'leave the space': PERMISSION.spacesLeave,
  'rename a space': PERMISSION.spacesRename,
  'end a space': PERMISSION.spacesEnd,
  'manage who is in the space': PERMISSION.spacesManageMembers,
  'make the game choice': PERMISSION.spacesSelectGame,
  'create a Custom Game': PERMISSION.chessCustomCreate,
  'configure a Custom Game': PERMISSION.chessCustomConfigure,
  'invite a Custom Game participant': PERMISSION.chessCustomInvite,
  'configure a Custom Game bot': PERMISSION.chessCustomBot,
  'start a Custom Game': PERMISSION.chessCustomStart,
  'cancel a Custom Game': PERMISSION.chessCustomCancel,
  'join a Custom Game': PERMISSION.chessCustomJoin,
  'watch a Custom Game': PERMISSION.chessCustomWatch,
  'play a Custom Game': PERMISSION.chessCustomPlay,
} as const satisfies Readonly<Record<string, CatalogKey>>;

export type CapabilityId = keyof typeof CAPABILITY_KEYS;

/** Every key the catalog declares: permissions, limits and actions. */
export function catalogKeys(): readonly CatalogKey[] {
  return [
    ...Object.values(PERMISSION),
    ...Object.values(LIMIT),
    ...Object.values(ACTION),
  ];
}

function isCapabilityId(id: string): id is CapabilityId {
  return Object.hasOwn(CAPABILITY_KEYS, id);
}

/** The key a manifest capability is decided by; throws on an unknown id. */
export function capabilityKey(id: string): CatalogKey {
  if (!isCapabilityId(id)) {
    throw new Error(`conformance: "${id}" is not a declared capability`);
  }
  return CAPABILITY_KEYS[id];
}

function isLimitKey(key: string): key is AppLimit {
  return (Object.values(LIMIT) as readonly string[]).includes(key);
}

/** The granted (not counted, not consumed) key of a capability; throws otherwise. */
export function grantKeyOf(id: string): AppGrantKey {
  const key = capabilityKey(id);
  if (isLimitKey(key) || isQuotaAction(key)) {
    throw new Error(`conformance: "${id}" is not decided by a grant`);
  }
  return key;
}
