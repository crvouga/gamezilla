import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import type { MultiplayerNoticeResult } from '@libs/chess-matchmaking-shared/multiplayer-notices';

type EndedGame = Pick<MultiplayerGame, 'reason' | 'white_ms'>;

/** The side whose clock ran out, for the reasons that name it. */
export function flaggedSide(game: EndedGame): 'white' | 'black' | null {
  if (
    game.reason !== 'timeout' &&
    game.reason !== 'timeout vs insufficient material'
  )
    return null;
  return game.white_ms === 0 ? 'white' : 'black';
}

const REASONS: Readonly<Record<string, string>> = {
  checkmate: 'By checkmate.',
  resignation: 'By resignation.',
  agreement: 'Drawn by agreement.',
  stalemate: 'By stalemate.',
  repetition: 'By repetition.',
  'insufficient material': 'Neither side can checkmate.',
  'fifty moves': 'By the fifty-move rule.',
  'first move missed': "The first move wasn't made in time.",
  'account deletion': 'An account was deleted.',
};

/** Why the game ended, in the words the multiplayer result gives. */
export function resultReasonText(game: EndedGame): string | undefined {
  const flagged = flaggedSide(game);
  if (flagged !== null) {
    const side = flagged === 'white' ? 'White' : 'Black';
    return game.reason === 'timeout'
      ? `${side} ran out of time.`
      : `${side} ran out of time, but the other side cannot checkmate.`;
  }
  return game.reason === null ? undefined : REASONS[game.reason];
}

/** What a result notice says first: how the daily game ended for its reader. */
export function resultNoticeTitle(
  result: MultiplayerNoticeResult,
  opponent: string
): string {
  if (result === 'won') return `You won your daily game against ${opponent}`;
  if (result === 'lost') return `You lost your daily game against ${opponent}`;
  if (result === 'drawn') return `Your daily game against ${opponent} is drawn`;
  return `Your daily game against ${opponent} was aborted`;
}

export function turnNoticeTitle(opponent: string): string {
  return `It's your turn in your daily game against ${opponent}`;
}

/** What a turn reminder says first: the person's clock is low on time. */
export function turnReminderTitle(opponent: string): string {
  return `You're low on time in your daily game against ${opponent}`;
}

export function turnReminderBody(left: string): string {
  return `It's your turn. You have ${left} left to move.`;
}

const MINUTE_MS = 60_000;
const DAY_MINUTES = 24 * 60;

const count = (n: number, unit: string): string =>
  n === 1 ? `1 ${unit}` : `${String(n)} ${unit}s`;

/**
 * Time left on a daily game's clock in the units people plan by: `1 day`,
 * `6 hours`, `1 day 2 hours`, `40 minutes`. Rounded up to the smaller unit
 * named, so it never says less than is left.
 */
export function timeLeftText(ms: number): string {
  const minutes = Math.ceil(Math.max(0, ms) / MINUTE_MS);
  if (minutes < 60) return count(minutes, 'minute');
  if (minutes < DAY_MINUTES) {
    const rest = minutes % 60;
    const hours = count(Math.floor(minutes / 60), 'hour');
    return rest === 0 ? hours : `${hours} ${count(rest, 'minute')}`;
  }
  const hours = Math.ceil(minutes / 60);
  const days = count(Math.floor(hours / 24), 'day');
  return hours % 24 === 0 ? days : `${days} ${count(hours % 24, 'hour')}`;
}
