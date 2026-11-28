import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { GameSessionOperation } from './game-session-choice';
import {
  ChangeGameSession,
  ChangeLocalGameSession,
  EndLocalGameSessionOnTime,
  PlayGameSessionBot,
} from './game-session-commands';

export const GAME_SESSION_GRANT_KEYS = [
  PERMISSION.gameSessionCreate,
  PERMISSION.gameSessionConfigure,
  PERMISSION.gameSessionInvite,
  PERMISSION.gameSessionBot,
  PERMISSION.gameSessionStart,
  PERMISSION.gameSessionCancel,
  PERMISSION.gameSessionJoin,
  PERMISSION.gameSessionWatch,
  PERMISSION.gameSessionPlay,
] as const;

export function gameSessionPermission(
  operation: GameSessionOperation
): AppGrantKey {
  switch (operation) {
    case 'create':
    case 'rematch':
      return PERMISSION.gameSessionCreate;
    case 'invite':
    case 'revoke':
      return PERMISSION.gameSessionInvite;
    case 'bot':
    case 'difficulty':
      return PERMISSION.gameSessionBot;
    case 'start':
      return PERMISSION.gameSessionStart;
    case 'cancel':
      return PERMISSION.gameSessionCancel;
    case 'accept':
    case 'decline':
    case 'claim':
    case 'release':
    case 'ready':
    case 'unready':
      return PERMISSION.gameSessionJoin;
    case 'move':
    case 'commit':
    case 'reclaim':
    case 'resign':
    case 'offer':
    case 'agree':
    case 'reject':
    case 'claimWin':
      return PERMISSION.gameSessionPlay;
    default:
      return PERMISSION.gameSessionConfigure;
  }
}

export function gameSessionCommandPermission(
  command: Message
): { readonly key: AppGrantKey; readonly reason: string } | null {
  if (PlayGameSessionBot.is(command) && 'move' in command.payload)
    return {
      key: PERMISSION.gameSessionBot,
      reason: 'only the creator moves a bot',
    };
  if (EndLocalGameSessionOnTime.is(command))
    return {
      key: PERMISSION.gameSessionCreate,
      reason: 'only the creator runs a solo clock',
    };
  const choice = ChangeLocalGameSession.is(command)
    ? command.payload.choice
    : ChangeGameSession.is(command)
      ? command.payload
      : null;
  if (choice === null) return null;
  const key = gameSessionPermission(choice.operation);
  const reason =
    key === PERMISSION.gameSessionCreate
      ? 'only the host creates a Game Session'
      : key === PERMISSION.gameSessionStart
        ? 'only the creator starts the Game Session'
        : key === PERMISSION.gameSessionCancel
          ? 'only the creator cancels the Game Session'
          : key === PERMISSION.gameSessionJoin ||
              key === PERMISSION.gameSessionPlay
            ? 'not in the space'
            : 'only the creator configures the Game Session';
  return { key, reason };
}
