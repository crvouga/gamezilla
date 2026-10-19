import type { GameCommandContext } from '@libs/spaces-shared/game';
import type { Message } from '@pkgs/message-shared/message';
import type { RoomState } from '@pkgs/room-root-shared/types';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { PlayCustomGameBot } from './custom-game-commands';
import { customGameBotMove } from './custom-game-position';
import type { CustomGame } from './custom-game-state';
import { CustomGamesAttr } from './custom-game-state';

/** Choices with another person are agreed online; solo choices stay local. */
export function soloCustomGame(game: CustomGame | null): boolean {
  return (
    game === null ||
    [game.white, game.black].every(
      (side) => side.person === '' || side.person === game.creator
    )
  );
}

export function localCustomGameChoiceAllowed(
  game: CustomGame | null,
  choice: CustomGameChoice
): boolean {
  return soloCustomGame(game) && choice.operation !== 'invite';
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
    game.id !== payload.payload.gameId
  )
    return payload;
  const move = customGameBotMove(game, rules, random);
  if (move === null) throw new Error('active bot game has no legal move');
  return PlayCustomGameBot({ ...payload.payload, at, move });
}
