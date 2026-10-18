/**
 * A chess game record (Portable Game Notation), read back as another chess
 * program reads it: written without chess's own code, from the copied text.
 */

import { chessHistoryBoard } from '@libs/chess-rules-shared/chess-harness';
import { copiedMultiplayerText } from '@libs/game-matchmaking-harness/multiplayer-game-record';
import type { ReadGameRecord } from '@libs/game-session-harness/harness-game';
import type { ProductHarness } from '@libs/harness/harness';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const DAY_SECONDS = 86_400;

/** A game record as another chess program reads it. */
export type CopiedGameRecord = {
  readonly white: string | null;
  readonly black: string | null;
  /** `1-0`, `0-1` or `1/2-1/2`. */
  readonly result: string | null;
  /** The time control as multiplayer chess names it: `5+0`, `3d`. */
  readonly timeControl: string | null;
  /** The moves in algebraic notation, without the result: `1. e4 e5`. */
  readonly moves: string;
  /** A chess program loads it and plays every move through. */
  readonly opens: boolean;
};

/** Portable Game Notation's time control, in multiplayer chess's words. */
function namedTimeControl(tag: string | undefined): string | null {
  if (tag === undefined) return null;
  const timed = /^(\d+)\+(\d+)$/.exec(tag);
  if (timed !== null)
    return `${String(Number(timed[1]) / 60)}+${String(Number(timed[2]))}`;
  const daily = /^1\/(\d+)$/.exec(tag);
  return daily === null ? tag : `${String(Number(daily[1]) / DAY_SECONDS)}d`;
}

function opens(record: string, moves: string): boolean {
  try {
    const played = chessHistoryBoard({ fen: START, pgn: record }).history();
    return played.length > 0 && played.every((move) => moves.includes(move));
  } catch {
    return false;
  }
}

/** A game record as another chess program reads it; null when it is none. */
export function readGameRecord(record: string): CopiedGameRecord | null {
  if (!record.startsWith('[')) return null;
  const lines = record.split('\n').map((line) => line.trim());
  const tags = new Map<string, string>();
  for (const line of lines) {
    const tag = /^\[(\w+) "(.*)"\]$/.exec(line);
    if (tag !== null) tags.set(tag[1] ?? '', tag[2] ?? '');
  }
  const result = tags.get('Result') ?? null;
  const text = lines.filter((line) => !line.startsWith('[')).join(' ');
  const moves =
    result !== null && text.trim().endsWith(result)
      ? text.trim().slice(0, -result.length).trim()
      : text.trim();
  return {
    white: tags.get('White') ?? null,
    black: tags.get('Black') ?? null,
    result,
    timeControl: namedTimeControl(tags.get('TimeControl')),
    moves,
    opens: moves !== text.trim() && opens(record, moves),
  };
}

/** The game record a person last copied; null when they copied none. */
export async function copiedGameRecord(
  s: ProductHarness,
  actor: string
): Promise<CopiedGameRecord | null> {
  const record = await copiedMultiplayerText(s, actor);
  return record === null ? null : readGameRecord(record);
}

/** Portable Game Notation's result, as the side it gives the game. */
const RESULTS: Readonly<Record<string, ReadGameRecord['result']>> = {
  '1-0': 'white',
  '0-1': 'black',
  '1/2-1/2': 'draw',
};

/** A move number in the movetext (`1.`, `12...`), which names no move. */
const MOVE_NUMBER = /^\d+\.+$/;

/**
 * A chess game record read back for the shared suites: White's and Black's
 * names, the result, the time control and every move in algebraic notation.
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
