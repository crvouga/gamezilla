import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { PlayCustomGameBot } from './custom-game-commands';
import { customGameBotMove } from './custom-game-position';
import type { CustomGame } from './custom-game-state';
import { CustomGamesAttr } from './custom-game-state';

/**
 * Choices with another person are agreed online; solo choices stay on the
 * creator's device. A game with private setups or dealt hands is never
 * solo: its bot's setup, and every hand and the hidden state, are the
 * room's alone to hold, so it is always played online.
 */
export function soloCustomGame(
  game: CustomGame | null,
  rules: TurnGames
): boolean {
  return (
    game === null ||
    (rules.forPosition(game.fen).setup === undefined &&
      rules.forPosition(game.fen).hands === undefined &&
      game.sides.every(
        (side) => game[side].person === '' || game[side].person === game.creator
      ))
  );
}

export function localCustomGameChoiceAllowed(
  game: CustomGame | null,
  choice: CustomGameChoice,
  rules: TurnGames
): boolean {
  return soloCustomGame(game, rules) && choice.operation !== 'invite';
}

/** Choose once, then replay the same legal move on every receiving device. */
export function prepareLocalCustomGameCommand(
  state: RoomState,
  payload: Message,
  turn: { at: number; random: GameCommandContext['random'] },
  rules: TurnGames
): Message {
  const { at, random } = turn;
  if (!PlayCustomGameBot.is(payload) || 'move' in payload.payload)
    return payload;
  const game = CustomGamesAttr.from(state).current;
  if (
    game?.status !== 'active' ||
    game.moves.length !== payload.payload.ply ||
    game.id !== payload.payload.gameId ||
    // A bot's hand is the room's alone: the room chooses its move.
    rules.forPosition(game.fen).hands !== undefined
  )
    return payload;
  const move = customGameBotMove(game, rules, { random, hand: null });
  if (move === null) throw new Error('active bot game has no legal move');
  return PlayCustomGameBot({ ...payload.payload, at, move });
}
