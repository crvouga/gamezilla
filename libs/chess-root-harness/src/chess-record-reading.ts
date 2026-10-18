import { readGameRecord } from '@libs/chess-matchmaking-harness/multiplayer-game-record';
import type { ReadGameRecord } from '@libs/game-session-harness/harness-game';

/** Portable Game Notation's result, as the side it gives the game. */
const RESULTS: Readonly<Record<string, ReadGameRecord['result']>> = {
  '1-0': 'white',
  '0-1': 'black',
  '1/2-1/2': 'draw',
};

/** A move number in the movetext (`1.`, `12...`), which names no move. */
const MOVE_NUMBER = /^\d+\.+$/;

/**
 * A chess game record (Portable Game Notation) read back: White's and
 * Black's names, the result, the time control and every move in algebraic
 * notation.
 */
export function readChessRecord(record: string): ReadGameRecord {
  const read = readGameRecord(record);
  if (read === null) throw new Error('The chess game record is not PGN');
  return {
    firstSide: read.white,
    secondSide: read.black,
    result: RESULTS[read.result ?? ''] ?? null,
    clockChoice: read.timeControl,
    moves: read.moves
      .split(/\s+/)
      .filter((token) => token !== '' && !MOVE_NUMBER.test(token)),
  };
}
