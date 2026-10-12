import type { MultiplayerGame } from './game-state';
import { multiplayerBoard } from './game-state';
import { timeControlOf } from './time-control';

/** White and Black as the person copying sees them now. */
export type GameRecordNames = {
  readonly white: string;
  readonly black: string;
};

type RecordFields = Pick<
  MultiplayerGame,
  | 'fen'
  | 'pgn'
  | 'outcome'
  | 'reason'
  | 'time_control'
  | 'white_rating'
  | 'black_rating'
>;

const RESULTS = { white: '1-0', black: '0-1', draw: '1/2-1/2' } as const;
const DAY_SECONDS = 86_400;

/** The multiplayer result as a game record writes it; null without one. */
export function gameRecordResult(
  outcome: MultiplayerGame['outcome']
): (typeof RESULTS)[keyof typeof RESULTS] | null {
  return outcome === 'white' || outcome === 'black' || outcome === 'draw'
    ? RESULTS[outcome]
    : null;
}

/**
 * A time control in Portable Game Notation: starting seconds and increment
 * (`300+0`), or one move in a daily game's seconds (`1/259200`).
 */
function recordTimeControl(timeControl: string | null): string {
  const control = timeControlOf(timeControl);
  if (control === null) return '?';
  if (control.daysPerMove > 0)
    return `1/${String(control.daysPerMove * DAY_SECONDS)}`;
  return `${String(control.minutes * 60)}+${String(control.incrementSeconds)}`;
}

/** Tag text other chess programs read back: no quotes, no escapes. */
function tagText(text: string): string {
  return text.replaceAll('"', "'").replaceAll('\\', '/');
}

/** The whole number of a rating as it was shown (`1500?` is `1500`). */
function ratingDigits(rating: string | null): string {
  return /^\d+/.exec(rating ?? '')?.[0] ?? '';
}

function termination(reason: string | null): string {
  return reason === 'timeout' || reason === 'timeout vs insufficient material'
    ? 'time forfeit'
    : 'normal';
}

/**
 * The game record of a finished multiplayer game, in Portable Game Notation
 * as other chess programs read it: who played White and Black, the
 * multiplayer result, the time control and every move. An unfinished or
 * aborted game has none.
 */
export function gameRecord(
  game: RecordFields,
  names: GameRecordNames
): string | null {
  const result = gameRecordResult(game.outcome);
  if (result === null) return null;
  const board = multiplayerBoard(game);
  board.setHeader('Event', 'Multiplayer chess');
  board.setHeader('White', tagText(names.white));
  board.setHeader('Black', tagText(names.black));
  board.setHeader('Result', result);
  board.setHeader('TimeControl', recordTimeControl(game.time_control));
  const ratings = [
    ['WhiteElo', ratingDigits(game.white_rating)],
    ['BlackElo', ratingDigits(game.black_rating)],
  ] as const;
  for (const [tag, rating] of ratings)
    if (rating.length > 0) board.setHeader(tag, rating);
  board.setHeader('Termination', termination(game.reason));
  return board.pgn();
}
