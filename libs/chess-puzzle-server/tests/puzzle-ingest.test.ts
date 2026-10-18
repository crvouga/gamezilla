import { describe, expect, test } from 'bun:test';

import {
  PuzzleIngestTally,
  partitionPuzzleBatch,
} from '@libs/chess-puzzle-server/puzzle-ingest';
import type { CatalogueRow } from '@libs/game-puzzle-shared/puzzle-catalogue';

const FEN = '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32';

function record(id: string, moves = 'd2c3 d4g1', fen = FEN) {
  return {
    PuzzleId: id,
    FEN: fen,
    Moves: moves,
    Rating: '1275',
    RatingDeviation: '112',
    Popularity: '100',
    NbPlays: '43',
    Themes: 'mate mateIn1',
    GameUrl: 'https://lichess.org/i64FoDh8#63',
    OpeningTags: '',
  };
}

function accepted(tally: PuzzleIngestTally, id: string, fen = FEN) {
  const row = tally.accept(record(id, 'd2c3 d4g1', fen));
  if (row === null) throw new Error('fixture must validate');
  return row;
}

describe('PuzzleIngestTally', () => {
  test('counts every rejection reason and keeps accepted rows canonical', () => {
    const tally = new PuzzleIngestTally();
    expect(tally.accept(record('ok'))?.moves).toBe('d2c3 d4g1');
    expect(tally.accept(record('odd', 'd2c3'))).toBeNull();
    expect(tally.accept(record('bad', 'd2c3 d4g1', 'nope'))).toBeNull();
    expect(tally.accept(record('ill', 'd2c3 g1g2'))).toBeNull();
    expect(tally.accept(record('', 'd2c3 d4g1'))).toBeNull();
    expect(tally.accepted).toBe(1);
    expect(tally.skipped()).toMatchObject({
      tooShort: 1,
      invalidFen: 1,
      illegalMove: 1,
      missingField: 1,
      oddLength: 0,
      duplicateId: 0,
      duplicatePosition: 0,
    });
  });
});

describe('partitionPuzzleBatch', () => {
  const tally = new PuzzleIngestTally();
  const a = accepted(tally, 'a');
  const sameLineOtherClock = accepted(
    tally,
    'b',
    FEN.replace(' 1 32', ' 0 40')
  );
  const other: CatalogueRow = { ...a, id: 'c', position_key: 'other' };

  test('a re-seeded id is a duplicate id, not new content', () => {
    const split = partitionPuzzleBatch([a], [{ id: 'a', position_key: null }]);
    expect(split).toEqual({ novel: [], duplicateId: 1, duplicatePosition: 0 });
  });

  test('same position + solution under a new id is skipped', () => {
    expect(sameLineOtherClock.position_key).toBe(a.position_key);
    const stored = partitionPuzzleBatch(
      [sameLineOtherClock],
      [{ id: 'a', position_key: a.position_key }]
    );
    expect(stored.duplicatePosition).toBe(1);
    const inBatch = partitionPuzzleBatch([a, sameLineOtherClock, other], []);
    expect(inBatch.novel.map((row) => row.id)).toEqual(['a', 'c']);
    expect(inBatch.duplicatePosition).toBe(1);
  });
});
