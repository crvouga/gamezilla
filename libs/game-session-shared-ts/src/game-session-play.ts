import {
  pendingCommitments,
  type TurnGames,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSessionChoice } from './game-session-choice';
import { gameSessionOutcome } from './game-session-outcome';
import {
  assertGameSessionPosition,
  rememberGameSessionPosition,
} from './game-session-position';
import type { GameSession, GameSessionSide } from './game-session-state';
import {
  gameSessionCommitting,
  gameSessionPersonSide,
  gameSessionRemaining,
  gameSessionTimeLeft,
  otherGameSessionSide,
} from './game-session-state';

export function finishGameSession(
  game: GameSession,
  outcome: GameSession['outcome'],
  now: number,
  reason = ''
): GameSession {
  return {
    ...game,
    status: outcome === 'cancelled' ? 'cancelled' : 'completed',
    outcome,
    outcomeReason: reason,
    drawAcceptedBy: [],
    endedAt: Math.floor(now),
    drawOfferedBy: '',
    declinedOffers: [],
    awaiting: [],
    committed: [],
    standIns: [],
    remaining: gameSessionRemaining(game, now),
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

export function gameSessionWinOrDraw(
  game: GameSession,
  winner: GameSessionSide,
  reason: 'resignation' | 'time' | 'away',
  rules: TurnGames
): GameSession['outcome'] {
  if (rules.turnsForPosition(game.fen)?.canWin(game.fen, winner) === false)
    return 'draw';
  if (reason === 'away')
    return winner === 'white'
      ? 'white wins because black stayed away'
      : 'black wins because white stayed away';
  return reason === 'time'
    ? `${winner} wins on time`
    : `${winner} wins by resignation`;
}

export function expireGameSession(
  game: GameSession,
  now: number,
  rules: TurnGames
): GameSession {
  if (
    game.status !== 'active' ||
    game.minutes === 0 ||
    gameSessionCommitting(game) ||
    gameSessionTimeLeft(game, game.turn, now) > 0
  )
    return game;
  return game.sides.length > 2
    ? finishGameSession(game, 'draw', now, 'timeout')
    : finishGameSession(
        game,
        gameSessionWinOrDraw(
          game,
          otherGameSessionSide(game.turn),
          'time',
          rules
        ),
        now
      );
}

/** The game at a new position: a phase of private commitments opens when its rules start one. */
function openedCommitments(game: GameSession, rules: TurnGames): GameSession {
  const turns = rules.turnsForPosition(game.fen);
  return {
    ...game,
    awaiting:
      turns === undefined ? [] : [...pendingCommitments(turns, game.fen, [])],
    committed: [],
  };
}

/**
 * The game after the public action `uci`: a side's move, or the resolution
 * of every private commitment, which no side's clock pays for.
 */
export function playGameSessionMove(
  game: GameSession,
  uci: string,
  now: number,
  rules: TurnGames
): GameSession | null {
  if (game.status !== 'active') return null;
  const turns = rules.turnsForPosition(game.fen);
  if (turns === undefined) return null;
  assertGameSessionPosition(game, rules);
  const move = turns.play(
    game.fen,
    uci,
    '',
    game.moves.map((m) => m.uci)
  );
  if (move === null) return null;
  // Played from a verified position, the new one needs no replay of its own.
  rememberGameSessionPosition(
    { fen: move.position, moves: [...game.moves, { uci, san: move.label }] },
    turns
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
      turnStartedAt: Math.floor(now),
      remaining: resolution
        ? game.remaining
        : {
            ...game.remaining,
            [game.turn]:
              game.minutes === 0
                ? 0
                : gameSessionTimeLeft(game, game.turn, now) +
                  game.increment * 1000,
          },
    },
    rules
  );
  if (move.winner === null) return moved;
  // The rules name the result: a move can lose for its mover (a misère
  // ending), and several sides can share a win (a tie for the best score).
  return finishGameSession(
    moved,
    gameSessionOutcome(move.winner, String(move.reason), game.sides),
    now
  );
}

export function playGameSessionChoice(
  game: GameSession,
  choice: GameSessionChoice,
  decision: { actor: string; now: number },
  rules: TurnGames
): GameSession | null {
  const { actor, now } = decision;
  switch (choice.operation) {
    case 'start':
      return game.status === 'active'
        ? game
        : openedCommitments(
            {
              ...game,
              status: 'active',
              startedAt: Math.floor(now),
              turnStartedAt: Math.floor(now),
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
      return finishGameSession(game, 'cancelled', now);
    case 'resign': {
      const side = gameSessionPersonSide(game, actor);
      return side === null
        ? game
        : game.sides.length > 2
          ? finishGameSession(game, 'draw', now, 'participant withdrew')
          : finishGameSession(
              game,
              gameSessionWinOrDraw(
                game,
                otherGameSessionSide(side),
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
        ? finishGameSession(game, 'draw', now, 'agreement')
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
        return finishGameSession(game, 'draw', now, 'participant withdrew');
      const side = gameSessionPersonSide(game, actor);
      return side === null
        ? game
        : finishGameSession(
            game,
            gameSessionWinOrDraw(game, side, 'away', rules),
            now
          );
    }
    case 'move':
      return playGameSessionMove(game, choice.uci, now, rules);
    case 'reclaim': {
      // Between two commands is a safe point: a stand-in's wake still
      // waiting finds the side its person's again and decides nothing.
      const side = gameSessionPersonSide(game, actor);
      return { ...game, standIns: game.standIns.filter((s) => s !== side) };
    }
    default:
      return game;
  }
}
