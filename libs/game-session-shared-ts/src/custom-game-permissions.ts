import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { CustomGameOperation } from './custom-game-choice';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
  EndLocalCustomGameOnTime,
  PlayCustomGameBot,
} from './custom-game-commands';

export const CUSTOM_GAME_GRANT_KEYS = [
  PERMISSION.gameCustomCreate,
  PERMISSION.gameCustomConfigure,
  PERMISSION.gameCustomInvite,
  PERMISSION.gameCustomBot,
  PERMISSION.gameCustomStart,
  PERMISSION.gameCustomCancel,
  PERMISSION.gameCustomJoin,
  PERMISSION.gameCustomWatch,
  PERMISSION.gameCustomPlay,
] as const;

export function customGamePermission(
  operation: CustomGameOperation
): AppGrantKey {
  switch (operation) {
    case 'create':
    case 'rematch':
      return PERMISSION.gameCustomCreate;
    case 'invite':
    case 'revoke':
      return PERMISSION.gameCustomInvite;
    case 'bot':
    case 'difficulty':
      return PERMISSION.gameCustomBot;
    case 'start':
      return PERMISSION.gameCustomStart;
    case 'cancel':
      return PERMISSION.gameCustomCancel;
    case 'accept':
    case 'decline':
    case 'claim':
    case 'release':
    case 'ready':
    case 'unready':
      return PERMISSION.gameCustomJoin;
    case 'move':
    case 'resign':
    case 'offer':
    case 'agree':
    case 'reject':
    case 'claimWin':
      return PERMISSION.gameCustomPlay;
    default:
      return PERMISSION.gameCustomConfigure;
  }
}

export function customGameCommandPermission(
  command: Message
): { readonly key: AppGrantKey; readonly reason: string } | null {
  if (PlayCustomGameBot.is(command) && 'move' in command.payload)
    return {
      key: PERMISSION.gameCustomBot,
      reason: 'only the creator moves a bot',
    };
  if (EndLocalCustomGameOnTime.is(command))
    return {
      key: PERMISSION.gameCustomCreate,
      reason: 'only the creator runs a solo clock',
    };
  const choice = ChangeLocalCustomGame.is(command)
    ? command.payload.choice
    : ChangeCustomGame.is(command)
      ? command.payload
      : null;
  if (choice === null) return null;
  const key = customGamePermission(choice.operation);
  const reason =
    key === PERMISSION.gameCustomCreate
      ? 'only the host creates a Custom Game'
      : key === PERMISSION.gameCustomStart
        ? 'only the creator starts the Custom Game'
        : key === PERMISSION.gameCustomCancel
          ? 'only the creator cancels the Custom Game'
          : key === PERMISSION.gameCustomJoin ||
              key === PERMISSION.gameCustomPlay
            ? 'not in the space'
            : 'only the creator configures the Custom Game';
  return { key, reason };
}
