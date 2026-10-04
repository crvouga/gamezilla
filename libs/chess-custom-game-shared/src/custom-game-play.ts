import type { CustomGameChoice } from './custom-game-choice';
import {
  customGameCanMate,
  customGameChess,
  customGameMoveInput,
} from './custom-game-position';
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
  reason: 'resignation' | 'time'
): CustomGame['outcome'] {
  if (!customGameCanMate(customGameChess(game), winner)) return 'draw';
  return reason === 'time'
    ? `${winner} wins on time`
    : `${winner} wins by resignation`;
}

export function expireCustomGame(game: CustomGame, now: number): CustomGame {
  if (
    game.status !== 'active' ||
    game.minutes === 0 ||
    customGameTimeLeft(game, game.turn, now) > 0
  )
    return game;
  return finishCustomGame(
    game,
    customGameWinOrDraw(game, otherCustomGameSide(game.turn), 'time'),
    now
  );
}

export function playCustomGameMove(
  game: CustomGame,
  uci: string,
  now: number
): CustomGame | null {
  const chess = customGameChess(game);
  let move;
  try {
    move = chess.move(customGameMoveInput(uci));
  } catch {
    return null;
  }
  const moved: CustomGame = {
    ...game,
    fen: chess.fen(),
    turn: chess.turn() === 'w' ? 'white' : 'black',
    moves: [...game.moves, { uci, san: move.san }],
    drawOfferedBy: '',
    turnStartedAt: now,
    remaining: {
      ...game.remaining,
      [game.turn]:
        game.minutes === 0
          ? 0
          : customGameTimeLeft(game, game.turn, now) + game.increment * 1000,
    },
  };
  if (chess.isCheckmate())
    return finishCustomGame(moved, `${game.turn} wins by checkmate`, now);
  if (chess.isDraw()) return finishCustomGame(moved, 'draw', now);
  return moved;
}

export function playCustomGameChoice(
  game: CustomGame,
  choice: CustomGameChoice,
  actor: string,
  now: number
): CustomGame | null {
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
            customGameWinOrDraw(game, otherCustomGameSide(side), 'resignation'),
            now
          );
    }
    case 'offer':
      return { ...game, drawOfferedBy: actor };
    case 'agree':
      return finishCustomGame(game, 'draw', now);
    case 'reject':
      return { ...game, drawOfferedBy: '' };
    case 'move':
      return playCustomGameMove(game, choice.uci, now);
    default:
      return game;
  }
}
