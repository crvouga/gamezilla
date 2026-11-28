import type { GameCommandContext } from '@libs/spaces-shared-ts/game';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import {
  ChangeLocalGameSession,
  PlayGameSessionBot,
} from './game-session-commands';
import { gameSessionHand, gameSessionHandsRules } from './game-session-hands';
import { gameSessionBots } from './game-session-position';
import { creatorAloneInGameSession } from './game-session-solo';
import type { GameSession } from './game-session-state';
import { GameSessionsAttr } from './game-session-state';

/**
 * Choices with another person are agreed online; solo choices stay on the
 * creator's device. A game with private setups is never solo: its bot's
 * setup is the room's alone to hold. A game with dealt hands is: practising
 * against bots, the creator's device deals from draws it makes once and
 * holds the hidden state and the bots' hands, which no other person reads.
 */
export function soloGameSession(
  game: GameSession | null,
  rules: TurnGames
): boolean {
  return (
    game === null ||
    (rules.forPosition(game.fen).setup === undefined &&
      creatorAloneInGameSession(game))
  );
}

export function localGameSessionChoiceAllowed(
  game: GameSession | null,
  choice: GameSessionChoice,
  rules: TurnGames
): boolean {
  return soloGameSession(game, rules) && choice.operation !== 'invite';
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
  if (!ChangeLocalGameSession.is(payload)) return payload;
  const { choice } = payload.payload;
  const game = GameSessionsAttr.from(state).current;
  if (choice.operation !== 'start' || game?.status !== 'configuring')
    return payload;
  const hands = gameSessionHandsRules(game, rules);
  if (hands === undefined || payload.payload.draws !== undefined)
    return payload;
  const draws: number[] = [];
  hands.deal(game.fen, () => {
    const draw = random();
    draws.push(draw);
    return draw;
  });
  return ChangeLocalGameSession({ ...payload.payload, draws });
}

/** Choose once, then replay the same legal move on every receiving device. */
export function prepareLocalGameSessionCommand(
  state: RoomState,
  payload: Message,
  turn: { at: number; random: GameCommandContext['random'] },
  rules: TurnGames
): Message {
  const { at, random } = turn;
  if (!PlayGameSessionBot.is(payload) || 'move' in payload.payload)
    return withDealDraws(state, payload, random, rules);
  const game = GameSessionsAttr.from(state).current;
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
  // A stand-in plays an away person's side; only the room chooses for it.
  if (game.standIns.includes(side)) return payload;
  const hands = gameSessionHandsRules(game, rules);
  const hand = hands === undefined ? null : gameSessionHand(state, game, side);
  if (hands !== undefined && hand === null) return payload;
  const move =
    gameSessionBots(game, rules).choose?.(
      game.fen,
      game.difficulty[side],
      random,
      hand
    ) ?? null;
  if (move === null) throw new Error('active bot game has no legal move');
  return PlayGameSessionBot({ ...payload.payload, at, move });
}
