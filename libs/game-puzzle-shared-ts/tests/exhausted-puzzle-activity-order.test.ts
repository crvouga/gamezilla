import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { buildExhaustedPuzzleCandidatesSql } from '@libs/game-puzzle-shared-ts/next-puzzle-selection';

// regression: exhausted-puzzle-same-instant-order
test('an exhausted pool keeps play order when all interactions share an instant', () => {
  using db = new Database(':memory:');
  db.run(`CREATE TABLE chess_puzzles (
    id TEXT PRIMARY KEY, rating INTEGER, popularity INTEGER,
    nb_plays INTEGER, themes TEXT, deleted_at TEXT
  )`);
  db.run(`CREATE TABLE chess_puzzle_interactions (
    owner_id TEXT, puzzle_id TEXT, at TEXT, activity_order INTEGER
  )`);
  for (const [id, order] of [
    ['one', 4],
    ['two', 5],
    ['three', 3],
  ] as const) {
    db.run('INSERT INTO chess_puzzles VALUES (?, 1500, 90, 300, ?, NULL)', [
      id,
      '[]',
    ]);
    db.run('INSERT INTO chess_puzzle_interactions VALUES (?, ?, ?, ?)', [
      'alice',
      id,
      '2024-06-01T00:04:20.600Z',
      order,
    ]);
  }
  const query = buildExhaustedPuzzleCandidatesSql({
    namespace: '',
    ownerId: 'alice',
    themes: [],
    currentPuzzleId: 'two',
  });
  const rows = db
    .query(query.sql)
    .all(...(query.values as (string | number)[])) as { id: string }[];
  expect(rows.map((row) => row.id)).toEqual(['three', 'one']);
});
