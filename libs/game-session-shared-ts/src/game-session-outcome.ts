import {
  type GameSide,
  type GameWinner,
  plainWinner,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { GameSession, GameSessionSide } from './game-session-state';

/**
 * A finished game session's stored outcome for a result the rules named:
 * `draw`, `<side> wins by <reason>`, or, for joint winners,
 * `<side>, <side> and <side> win by <reason>`.
 */
export function gameSessionOutcome(
  winner: GameWinner,
  reason: string,
  sides: readonly GameSide[]
): GameSession['outcome'] {
  const plain = plainWinner(winner, sides);
  if (plain === 'draw') return 'draw';
  if (typeof plain === 'string') return `${plain} wins by ${reason}`;
  const named = `${plain.slice(0, -1).join(', ')} and ${plain.at(-1)!}`;
  return `${named} win by ${reason}`;
}

const SINGLE = /^(white|black|red|blue) wins\b/;
const JOINT =
  /^((?:white|black|red|blue)(?:, (?:white|black|red|blue))*) and (white|black|red|blue) win by /;

/**
 * The sides a finished game's result went to: every side for a draw, none
 * for a cancelled or unfinished game.
 */
export function gameSessionWinners(
  game: Pick<GameSession, 'status' | 'outcome' | 'sides'>
): readonly GameSessionSide[] {
  if (game.status !== 'completed') return [];
  if (game.outcome === 'draw') return game.sides;
  const single = SINGLE.exec(game.outcome);
  if (single !== null) return [single[1] as GameSessionSide];
  const joint = JOINT.exec(game.outcome);
  if (joint === null) return [];
  const named = [...joint[1]!.split(', '), joint[2]!];
  return game.sides.filter((side) => named.includes(side));
}

/** The rules' ending reason a won outcome names (`resignation`, a game's own). */
export function gameSessionOutcomeReason(outcome: string): string {
  const at = outcome.search(/ wins? by /);
  return at < 0 ? '' : outcome.slice(outcome.indexOf(' by ', at) + 4);
}
