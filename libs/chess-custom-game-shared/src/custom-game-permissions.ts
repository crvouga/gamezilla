import type { AppGrantKey } from '@libs/permissions-shared/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { Message } from '@pkgs/message-shared/message';
import type { CustomGameOperation } from './custom-game-choice';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
  EndLocalCustomGameOnTime,
  PlayCustomGameBot,
} from './custom-game-commands';

export const CUSTOM_GAME_GRANT_KEYS = [
  PERMISSION.chessCustomCreate,
  PERMISSION.chessCustomConfigure,
  PERMISSION.chessCustomInvite,
  PERMISSION.chessCustomBot,
  PERMISSION.chessCustomStart,
  PERMISSION.chessCustomCancel,
  PERMISSION.chessCustomJoin,
  PERMISSION.chessCustomWatch,
  PERMISSION.chessCustomPlay,
] as const;

export function customGamePermission(
  operation: CustomGameOperation
): AppGrantKey {
  switch (operation) {
    case 'create':
    case 'rematch':
      return PERMISSION.chessCustomCreate;
    case 'invite':
    case 'revoke':
      return PERMISSION.chessCustomInvite;
    case 'bot':
      return PERMISSION.chessCustomBot;
    case 'start':
      return PERMISSION.chessCustomStart;
    case 'cancel':
      return PERMISSION.chessCustomCancel;
    case 'accept':
    case 'decline':
    case 'claim':
    case 'release':
    case 'ready':
    case 'unready':
      return PERMISSION.chessCustomJoin;
    case 'move':
    case 'resign':
    case 'offer':
    case 'agree':
    case 'reject':
    case 'claimWin':
      return PERMISSION.chessCustomPlay;
    default:
      return PERMISSION.chessCustomConfigure;
  }
}

export function customGameCommandPermission(
  command: Message
): { readonly key: AppGrantKey; readonly reason: string } | null {
  if (PlayCustomGameBot.is(command) && 'move' in command.payload)
    return {
      key: PERMISSION.chessCustomBot,
      reason: 'only the creator moves a bot',
    };
  if (EndLocalCustomGameOnTime.is(command))
    return {
      key: PERMISSION.chessCustomCreate,
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
    key === PERMISSION.chessCustomCreate
      ? 'only the host creates a Custom Game'
      : key === PERMISSION.chessCustomStart
        ? 'only the creator starts the Custom Game'
        : key === PERMISSION.chessCustomCancel
          ? 'only the creator cancels the Custom Game'
          : key === PERMISSION.chessCustomJoin ||
              key === PERMISSION.chessCustomPlay
            ? 'not in the space'
            : 'only the creator configures the Custom Game';
  return { key, reason };
}
