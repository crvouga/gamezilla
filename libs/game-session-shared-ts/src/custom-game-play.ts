import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { assertCustomGamePosition } from './custom-game-position';
import type { CustomGame, CustomGameSide } from './custom-game-state';
import {
  customGamePersonSide,
  customGameTimeLeft,
  otherCustomGameSide,
} from './custom-game-state';

export function finishCustomGame(
  game: CustomGame,
  outcome: CustomGame['outcome'],
  now: number
): CustomGame {
  return {
    ...game,
    status: outcome === 'cancelled' ? 'cancelled' : 'completed',
    outcome,
    endedAt: now,
    drawOfferedBy: '',
    declinedOffers: [],
    remaining: {
      white: customGameTimeLeft(game, 'white', now),
      black: customGameTimeLeft(game, 'black', now),
    },
    ready: outcome === 'cancelled' ? [] : game.ready,
    white:
      game.white.kind === 'invitation'
        ? { kind: 'open', person: '' }
        : game.white,
    black:
      game.black.kind === 'invitation'
        ? { kind: 'open', person: '' }
        : game.black,
  };
}

export function customGameWinOrDraw(
  game: CustomGame,
  winner: CustomGameSide,
  reason: 'resignation' | 'time' | 'away',
  rules: TurnGames
): CustomGame['outcome'] {
  if (!rules.forPosition(game.fen).canWin(game.fen, winner)) return 'draw';
  if (reason === 'away')
    return winner === 'white'
      ? 'white wins because black stayed away'
      : 'black wins because white stayed away';
  return reason === 'time'
    ? `${winner} wins on time`
    : `${winner} wins by resignation`;
}

export function expireCustomGame(
  game: CustomGame,
  now: number,
  rules: TurnGames
): CustomGame {
  if (
    game.status !== 'active' ||
    game.minutes === 0 ||
    customGameTimeLeft(game, game.turn, now) > 0
  )
    return game;
  return finishCustomGame(
    game,
    customGameWinOrDraw(game, otherCustomGameSide(game.turn), 'time', rules),
    now
  );
}

export function playCustomGameMove(
  game: CustomGame,
  uci: string,
  now: number,
  rules: TurnGames
): CustomGame | null {
  if (game.status !== 'active') return null;
  assertCustomGamePosition(game, rules);
  const move = rules.forPosition(game.fen).play(
    game.fen,
    uci,
    '',
    game.moves.map((m) => m.uci)
  );
  if (move === null) return null;
  const moved: CustomGame = {
    ...game,
    fen: move.position,
    turn: move.turn,
    moves: [...game.moves, { uci, san: move.label }],
    drawOfferedBy: '',
    declinedOffers: game.declinedOffers.filter(
      (person) => person !== game[game.turn].person
    ),
    turnStartedAt: now,
    remaining: {
      ...game.remaining,
      [game.turn]:
        game.minutes === 0
          ? 0
          : customGameTimeLeft(game, game.turn, now) + game.increment * 1000,
    },
  };
  if (move.winner === 'draw') return finishCustomGame(moved, 'draw', now);
  // The rules name the winner: a move can lose for its mover (a misère
  // ending), so the side that moved is not assumed to have won.
  if (move.winner !== null)
    return finishCustomGame(
      moved,
      `${move.winner} wins by ${move.reason}`,
      now
    );
  return moved;
}

export function playCustomGameChoice(
  game: CustomGame,
  choice: CustomGameChoice,
  decision: { actor: string; now: number },
  rules: TurnGames
): CustomGame | null {
  const { actor, now } = decision;
  switch (choice.operation) {
    case 'start':
      return game.status === 'active'
        ? game
        : {
            ...game,
            status: 'active',
            startedAt: now,
            turnStartedAt: now,
            remaining: {
              white: game.minutes * 60_000,
              black: game.minutes * 60_000,
            },
          };
    case 'cancel':
      return finishCustomGame(game, 'cancelled', now);
    case 'resign': {
      const side = customGamePersonSide(game, actor);
      return side === null
        ? game
        : finishCustomGame(
            game,
            customGameWinOrDraw(
              game,
              otherCustomGameSide(side),
              'resignation',
              rules
            ),
            now
          );
    }
    case 'offer':
      return { ...game, drawOfferedBy: actor };
    case 'agree':
      return finishCustomGame(game, 'draw', now);
    case 'reject':
      return {
        ...game,
        drawOfferedBy: '',
        declinedOffers: [...game.declinedOffers, game.drawOfferedBy],
      };
    case 'claimWin': {
      const side = customGamePersonSide(game, actor);
      return side === null
        ? game
        : finishCustomGame(
            game,
            customGameWinOrDraw(game, side, 'away', rules),
            now
          );
    }
    case 'move':
      return playCustomGameMove(game, choice.uci, now, rules);
    default:
      return game;
  }
}
