import {
  type AppGrantKey,
  PERMISSION,
} from '@libs/permissions/public/permission-catalog';
import type { Message } from '@pkgs/message';
import type { CustomGameOperation } from '../../../shared/custom-game/custom-game-choice';
import { ChangeCustomGame } from './custom-game-commands';

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
      return PERMISSION.chessCustomPlay;
    default:
      return PERMISSION.chessCustomConfigure;
  }
}

export function customGameCommandPermission(
  command: Message
): { readonly key: AppGrantKey; readonly reason: string } | null {
  if (!ChangeCustomGame.is(command)) return null;
  const key = customGamePermission(command.payload.operation);
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
