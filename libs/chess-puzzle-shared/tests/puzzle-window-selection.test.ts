/**
 * Which puzzle comes next, run against a real SQLite catalog: the rating
 * window (±100 settled, ±200 provisional) first, then the unplayed puzzle
 * nearest the feed target, and never a puzzle below the quality bar.
 */

import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import {
  PUZZLE_RATING_DEFAULT_RD,
  PUZZLE_RATING_RD_MIN,
} from '@libs/chess-puzzle-shared/chess-puzzle-rating';
import type { PuzzleCandidateRow } from '@libs/chess-puzzle-shared/next-puzzle-selection';
import {
  buildPuzzleCandidatesSql,
  PUZZLE_MIN_PLAYS,
  PUZZLE_MIN_POPULARITY,
  pickNextPuzzle,
  puzzleSelectionHalfWindow,
} from '@libs/chess-puzzle-shared/next-puzzle-selection';

type Stock = {
  readonly id: string;
  readonly rating: number;
  readonly popularity?: number;
  readonly plays?: number;
};

function catalog(stock: readonly Stock[]): Database {
  const db = new Database(':memory:');
  db.run(`CREATE TABLE chess_puzzles (
    id TEXT PRIMARY KEY, rating INTEGER, popularity INTEGER,
    nb_plays INTEGER, themes TEXT, deleted_at TEXT
  )`);
  db.run(`CREATE TABLE chess_puzzle_interactions (
    owner_id TEXT, puzzle_id TEXT, kind TEXT
  )`);
  for (const row of stock) {
    db.run('INSERT INTO chess_puzzles VALUES (?, ?, ?, ?, ?, NULL)', [
      row.id,
      row.rating,
      row.popularity ?? 90,
      row.plays ?? 300,
      '[]',
    ]);
  }
  return db;
}

function candidates(
  db: Database,
  rating: number,
  halfWindow: number | null
): PuzzleCandidateRow[] {
  const query = buildPuzzleCandidatesSql({
    rating,
    halfWindow,
    ownerId: 'alice',
    historyFilter: 'neverSeen',
    themes: [],
    currentPuzzleId: null,
    pickOffset: 0,
  });
  return db
    .query(query.sql)
    .all(...(query.values as (string | number)[])) as PuzzleCandidateRow[];
}

function next(db: Database, rating: number, ratingDeviation: number) {
  const halfWindow = puzzleSelectionHalfWindow(ratingDeviation);
  return pickNextPuzzle({
    banded: { rows: candidates(db, rating, halfWindow), isLoading: false },
    fallback: { rows: candidates(db, rating, null), isLoading: false },
    exhausted: [],
    rating,
    seed: 'seed',
  });
}

const SETTLED = PUZZLE_RATING_RD_MIN;
const PROVISIONAL = PUZZLE_RATING_DEFAULT_RD;

describe('the rating window', () => {
  test('a settled rating is served only from within 100 of the target', () => {
    const db = catalog([
      { id: 'p1450', rating: 1450 },
      { id: 'p1650', rating: 1650 },
      { id: 'p1900', rating: 1900 },
    ]);
    expect(next(db, 1500, SETTLED)).toEqual({
      puzzleId: 'p1450',
      source: 'unseen',
    });
  });

  test('a provisional rating is served from within 200 of the target', () => {
    const db = catalog([
      { id: 'p1690', rating: 1690 },
      { id: 'p1900', rating: 1900 },
    ]);
    expect(next(db, 1500, PROVISIONAL)).toEqual({
      puzzleId: 'p1690',
      source: 'unseen',
    });
  });

  test('the window edges are inclusive', () => {
    const db = catalog([{ id: 'p1600', rating: 1600 }]);
    expect(next(db, 1500, SETTLED).source).toBe('unseen');
  });
});

describe('the nearest unplayed puzzle when none fits the window', () => {
  test('the unplayed puzzle nearest the target comes next', () => {
    const db = catalog([
      { id: 'p1900', rating: 1900, popularity: 100 },
      { id: 'p1650', rating: 1650, popularity: 60 },
      { id: 'p1000', rating: 1000, popularity: 100 },
    ]);
    expect(next(db, 1500, SETTLED)).toEqual({
      puzzleId: 'p1650',
      source: 'widened',
    });
  });

  test('nearest holds below the target too, and for every seed', () => {
    const db = catalog([
      { id: 'p2200', rating: 2200 },
      { id: 'p1340', rating: 1340 },
      { id: 'p900', rating: 900 },
    ]);
    for (const seed of ['a', 'b', 'c', 'd']) {
      const pick = pickNextPuzzle({
        banded: { rows: candidates(db, 1500, 100), isLoading: false },
        fallback: { rows: candidates(db, 1500, null), isLoading: false },
        exhausted: [],
        rating: 1500,
        seed,
      });
      expect(pick.puzzleId).toBe('p1340');
    }
  });

  test('a played puzzle is never the nearest unplayed one', () => {
    const db = catalog([
      { id: 'p1700', rating: 1700 },
      { id: 'p2000', rating: 2000 },
    ]);
    db.run(
      "INSERT INTO chess_puzzle_interactions VALUES ('alice', 'p1700', 'solved')"
    );
    expect(next(db, 1500, SETTLED).puzzleId).toBe('p2000');
  });
});

describe('the quality bar', () => {
  test.each([
    [PUZZLE_MIN_POPULARITY, PUZZLE_MIN_PLAYS, true],
    [PUZZLE_MIN_POPULARITY - 1, 300, false],
    [90, PUZZLE_MIN_PLAYS - 1, false],
    [100, 100_000, true],
  ])(
    'popularity %i, played %i times: served %p',
    (popularity, plays, served) => {
      const db = catalog([{ id: 'only', rating: 1500, popularity, plays }]);
      expect(next(db, 1500, SETTLED).puzzleId).toBe(served ? 'only' : null);
    }
  );

  test('the bar is popularity 50 and 5 plays', () => {
    expect(PUZZLE_MIN_POPULARITY).toBe(50);
    expect(PUZZLE_MIN_PLAYS).toBe(5);
  });
});
