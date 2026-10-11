import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { multiplayerBoard } from '@libs/chess-matchmaking-shared/game-state';

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

/** The accepted moves in algebraic notation: `1. e4 e5 2. Nf3`. */
export function moveListText(
  game: Pick<MultiplayerGame, 'fen' | 'pgn'>
): string {
  if (game.pgn.length === 0) return '';
  const moves = multiplayerBoard(game).history({ verbose: true });
  const parts: string[] = [];
  moves.forEach((move, index) => {
    const number = move.before.split(' ')[5] ?? '1';
    if (move.color === 'w') parts.push(`${number}. ${move.san}`);
    else if (index === 0) parts.push(`${number}... ${move.san}`);
    else parts.push(move.san);
  });
  return parts.join(' ');
}
