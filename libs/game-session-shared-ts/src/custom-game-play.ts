import {
  pendingCommitments,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { CustomGameChoice } from './custom-game-choice';
import { customGameOutcome } from './custom-game-outcome';
import {
  assertCustomGamePosition,
  rememberCustomGamePosition,
} from './custom-game-position';
import type { CustomGame, CustomGameSide } from './custom-game-state';
import {
  customGameCommitting,
  customGamePersonSide,
  customGameRemaining,
  customGameTimeLeft,
  otherCustomGameSide,
} from './custom-game-state';

export function finishCustomGame(
  game: CustomGame,
  outcome: CustomGame['outcome'],
  now: number,
  reason = ''
): CustomGame {
  return {
    ...game,
    status: outcome === 'cancelled' ? 'cancelled' : 'completed',
    outcome,
    outcomeReason: reason,
    drawAcceptedBy: [],
    endedAt: now,
    drawOfferedBy: '',
    declinedOffers: [],
    awaiting: [],
    committed: [],
    standIns: [],
    remaining: customGameRemaining(game, now),
    ready: outcome === 'cancelled' ? [] : game.ready,
    white:
      game.white.kind === 'invitation'
        ? { kind: 'open', person: '' }
        : game.white,
    red:
      game.red.kind === 'invitation' ? { kind: 'open', person: '' } : game.red,
    blue:
      game.blue.kind === 'invitation'
        ? { kind: 'open', person: '' }
        : game.blue,
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
    customGameCommitting(game) ||
    customGameTimeLeft(game, game.turn, now) > 0
  )
    return game;
  return game.sides.length > 2
    ? finishCustomGame(game, 'draw', now, 'timeout')
    : finishCustomGame(
        game,
        customGameWinOrDraw(
          game,
          otherCustomGameSide(game.turn),
          'time',
          rules
        ),
        now
      );
}

/** The game at a new position: a phase of private commitments opens when its rules start one. */
function openedCommitments(game: CustomGame, rules: TurnGames): CustomGame {
  return {
    ...game,
    awaiting: [
      ...pendingCommitments(rules.forPosition(game.fen), game.fen, []),
    ],
    committed: [],
  };
}

/**
 * The game after the public action `uci`: a side's move, or the resolution
 * of every private commitment, which no side's clock pays for.
 */
export function playCustomGameMove(
  game: CustomGame,
  uci: string,
  now: number,
  rules: TurnGames
): CustomGame | null {
  if (game.status !== 'active') return null;
  assertCustomGamePosition(game, rules);
  const played = rules.forPosition(game.fen);
  const move = played.play(
    game.fen,
    uci,
    '',
    game.moves.map((m) => m.uci)
  );
  if (move === null) return null;
  // Played from a verified position, the new one needs no replay of its own.
  rememberCustomGamePosition(
    { fen: move.position, moves: [...game.moves, { uci, san: move.label }] },
    played
  );
  const resolution = game.committed.length > 0;
  const moved = openedCommitments(
    {
      ...game,
      fen: move.position,
      turn: move.turn,
      moves: [...game.moves, { uci, san: move.label }],
      drawOfferedBy: '',
      drawAcceptedBy: [],
      declinedOffers: resolution
        ? game.declinedOffers
        : game.declinedOffers.filter(
            (person) => person !== game[game.turn].person
          ),
      turnStartedAt: now,
      remaining: resolution
        ? game.remaining
        : {
            ...game.remaining,
            [game.turn]:
              game.minutes === 0
                ? 0
                : customGameTimeLeft(game, game.turn, now) +
                  game.increment * 1000,
          },
    },
    rules
  );
  if (move.winner === null) return moved;
  // The rules name the result: a move can lose for its mover (a misère
  // ending), and several sides can share a win (a tie for the best score).
  return finishCustomGame(
    moved,
    customGameOutcome(move.winner, String(move.reason), game.sides),
    now
  );
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
        : openedCommitments(
            {
              ...game,
              status: 'active',
              startedAt: now,
              turnStartedAt: now,
              remaining: {
                white: game.minutes * 60_000,
                black: game.minutes * 60_000,
                red: game.minutes * 60_000,
                blue: game.minutes * 60_000,
              },
            },
            rules
          );
    case 'cancel':
      return finishCustomGame(game, 'cancelled', now);
    case 'resign': {
      const side = customGamePersonSide(game, actor);
      return side === null
        ? game
        : game.sides.length > 2
          ? finishCustomGame(game, 'draw', now, 'participant withdrew')
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
      return { ...game, drawOfferedBy: actor, drawAcceptedBy: [actor] };
    case 'agree': {
      const accepted = [
        ...new Set([game.drawOfferedBy, ...game.drawAcceptedBy, actor]),
      ];
      return game.sides.every((side) => accepted.includes(game[side].person))
        ? finishCustomGame(game, 'draw', now, 'agreement')
        : { ...game, drawAcceptedBy: accepted };
    }
    case 'reject':
      return {
        ...game,
        drawOfferedBy: '',
        drawAcceptedBy: [],
        declinedOffers: [...game.declinedOffers, game.drawOfferedBy],
      };
    case 'claimWin': {
      if (game.sides.length > 2)
        return finishCustomGame(game, 'draw', now, 'participant withdrew');
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
    case 'reclaim': {
      // Between two commands is a safe point: a stand-in's wake still
      // waiting finds the side its person's again and decides nothing.
      const side = customGamePersonSide(game, actor);
      return { ...game, standIns: game.standIns.filter((s) => s !== side) };
    }
    default:
      return game;
  }
}
