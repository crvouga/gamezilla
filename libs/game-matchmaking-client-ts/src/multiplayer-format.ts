import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

/** A clock as people read it: whole seconds left, rounded up, as m:ss. */
export function clockLabel(ms: number): string {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${String(Math.floor(seconds / 60))}:${String(seconds % 60).padStart(2, '0')}`;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export type DailyClockParts =
  | { readonly unit: 'days'; readonly days: number; readonly hours: number }
  | { readonly unit: 'hours'; readonly hours: number; readonly minutes: number }
  | { readonly unit: 'seconds'; readonly ms: number };

/**
 * A daily game's clock in the units people plan by: days and hours while a
 * day or more is left, then hours and minutes, then the ordinary `m:ss`.
 * Every unit is rounded up, so the clock never shows less than is left.
 */
export function dailyClockParts(ms: number): DailyClockParts {
  const left = Math.max(0, ms);
  const minutes = Math.ceil(left / MINUTE_MS);
  if (minutes >= DAY_MS / MINUTE_MS) {
    const hours = Math.ceil(left / HOUR_MS);
    return { unit: 'days', days: Math.floor(hours / 24), hours: hours % 24 };
  }
  if (minutes >= 60)
    return {
      unit: 'hours',
      hours: Math.floor(minutes / 60),
      minutes: minutes % 60,
    };
  return { unit: 'seconds', ms: left };
}

/** How long until a daily clock with `ms` left next reads differently. */
export function dailyClockStepMs(ms: number): number {
  const parts = dailyClockParts(ms);
  const unit =
    parts.unit === 'days' ? HOUR_MS : parts.unit === 'hours' ? MINUTE_MS : 1000;
  return ((Math.max(1, ms) - 1) % unit) + 1;
}

/** One accepted move, and the position it led to. */
export type MultiplayerMove = {
  /** Moves played to reach the position after it: 1 for the first move. */
  readonly ply: number;
  /** The move in algebraic notation: `Nf3`. */
  readonly san: string;
  /** What the move list writes before it: `1.`, `1...`, or nothing. */
  readonly numbering: string;
  /** The move named by itself: `1. e4`, `1... e5`. */
  readonly name: string;
  /** The position before it and the position after it. */
  readonly before: string;
  readonly after: string;
};

/** The accepted moves of a game, in the order they were played. */
export function multiplayerMoves(
  game: Pick<MultiplayerGame, 'fen' | 'pgn'>,
  rules: TurnGames
): readonly MultiplayerMove[] {
  return rules
    .forPosition(game.fen)
    .moves(game.fen, game.pgn, [])
    .map((move, index) => ({
      ply: index + 1,
      san: move.label,
      numbering: index % 2 === 0 ? `${Math.floor(index / 2) + 1}.` : '',
      name: `${Math.floor(index / 2) + 1}${index % 2 === 0 ? '.' : '...'} ${move.label}`,
      before: move.before,
      after: move.after,
    }));
}

/**
 * The position after `ply` moves: the start of the game for none. Null when
 * the game never reached such a position.
 */
export function positionAfter(
  moves: readonly MultiplayerMove[],
  ply: number
): string | null {
  if (ply === 0) return moves[0]?.before ?? null;
  return moves[ply - 1]?.after ?? null;
}

/** The accepted moves in algebraic notation: `1. e4 e5 2. Nf3`. */
export function moveListText(
  game: Pick<MultiplayerGame, 'fen' | 'pgn'>,
  rules: TurnGames
): string {
  return multiplayerMoves(game, rules)
    .map((move) =>
      move.numbering === '' ? move.san : `${move.numbering} ${move.san}`
    )
    .join(' ');
}
