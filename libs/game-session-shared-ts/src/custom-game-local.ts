import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import {
  ChangeLocalCustomGame,
  PlayCustomGameBot,
} from './custom-game-commands';
import { customGameHand, customGameHandsRules } from './custom-game-hands';
import { customGameBots } from './custom-game-position';
import { creatorAloneInCustomGame } from './custom-game-solo';
import type { CustomGame } from './custom-game-state';
import { CustomGamesAttr } from './custom-game-state';

/**
 * Choices with another person are agreed online; solo choices stay on the
 * creator's device. A game with private setups is never solo: its bot's
 * setup is the room's alone to hold. A game with dealt hands is: practising
 * against bots, the creator's device deals from draws it makes once and
 * holds the hidden state and the bots' hands, which no other person reads.
 */
export function soloCustomGame(
  game: CustomGame | null,
  rules: TurnGames
): boolean {
  return (
    game === null ||
    (rules.forPosition(game.fen).setup === undefined &&
      creatorAloneInCustomGame(game))
  );
}

export function localCustomGameChoiceAllowed(
  game: CustomGame | null,
  choice: CustomGameChoice,
  rules: TurnGames
): boolean {
  return soloCustomGame(game, rules) && choice.operation !== 'invite';
}

/**
 * A solo start of a game with dealt hands carries the draws it deals from,
 * drawn here once, so the device and the room deal the same hands.
 */
function withDealDraws(
  state: RoomState,
  payload: Message,
  random: GameCommandContext['random'],
  rules: TurnGames
): Message {
  if (!ChangeLocalCustomGame.is(payload)) return payload;
  const { choice } = payload.payload;
  const game = CustomGamesAttr.from(state).current;
  if (choice.operation !== 'start' || game?.status !== 'configuring')
    return payload;
  const hands = customGameHandsRules(game, rules);
  if (hands === undefined || payload.payload.draws !== undefined)
    return payload;
  const draws: number[] = [];
  hands.deal(game.fen, () => {
    const draw = random();
    draws.push(draw);
    return draw;
  });
  return ChangeLocalCustomGame({ ...payload.payload, draws });
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
    return withDealDraws(state, payload, random, rules);
  const game = CustomGamesAttr.from(state).current;
  if (
    game?.status !== 'active' ||
    game.moves.length !== payload.payload.ply ||
    game.id !== payload.payload.gameId
  )
    return payload;
  // A bot decides for its own side from its own hand — its move, or its
  // commitment while every side commits — with a hand this copy holds only
  // when the game is the creator's solo practice.
  const side = payload.payload.side;
  const hands = customGameHandsRules(game, rules);
  const hand = hands === undefined ? null : customGameHand(state, game, side);
  if (hands !== undefined && hand === null) return payload;
  const move =
    customGameBots(game, rules).choose?.(
      game.fen,
      game.difficulty[side],
      random,
      hand
    ) ?? null;
  if (move === null) throw new Error('active bot game has no legal move');
  return PlayCustomGameBot({ ...payload.payload, at, move });
}
