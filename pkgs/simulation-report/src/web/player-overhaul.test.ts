import { describe, expect, test } from 'bun:test';

import type { SimulationStep } from '../types';
import { pickPrimaryViewFile, sanitizeViewNodeId } from '../writer/frame-views';
import { flattenFrames } from './frames';
import { parseTapAtRatios, parseTestIdSelector } from './interaction-overlay';
import { diffBySha } from './sql/sqlite-diff';

describe('parseTestIdSelector', () => {
  test('extracts id from testId("…")', () => {
    expect(parseTestIdSelector('testId("home")')).toBe('home');
    expect(parseTestIdSelector('testId("a.b")')).toBe('a.b');
  });
  test('returns null for other selectors', () => {
    expect(parseTestIdSelector('css("#x")')).toBeNull();
    expect(parseTestIdSelector(undefined)).toBeNull();
  });
});

describe('parseTapAtRatios', () => {
  test('parses xRatio/yRatio detail', () => {
    expect(parseTapAtRatios('xRatio=0.5, yRatio=0.25')).toEqual({
      xRatio: 0.5,
      yRatio: 0.25,
    });
  });
  test('returns null when incomplete', () => {
    expect(parseTapAtRatios('xRatio=0.5')).toBeNull();
  });
});

describe('frame views helpers', () => {
  test('sanitizeViewNodeId', () => {
    expect(sanitizeViewNodeId('alice')).toBe('alice');
    expect(sanitizeViewNodeId('a/b')).toBe('a_b');
  });
  test('pickPrimaryViewFile prefers acting actor', () => {
    const views = [
      { nodeId: 'alice', file: 'frames/f-00001.alice.html' },
      { nodeId: 'bob', file: 'frames/f-00001.bob.html' },
    ];
    expect(pickPrimaryViewFile(views, 'bob')).toBe('frames/f-00001.bob.html');
    expect(pickPrimaryViewFile(views, undefined)).toBe(
      'frames/f-00001.alice.html'
    );
  });
});

describe('flattenFrames views', () => {
  test('forwards frame views metadata', () => {
    const steps: SimulationStep[] = [
      {
        index: 1,
        actorId: 'alice',
        kind: 'tap',
        title: 't',
        status: 'passed',
        startedAtMs: 0,
        endedAtMs: 10,
        durationMs: 10,
        frames: [
          {
            file: 'frames/f-00001.alice.html',
            capturedAtMs: 5,
            durationMs: 5,
            views: [
              { nodeId: 'alice', file: 'frames/f-00001.alice.html' },
              { nodeId: 'bob', file: 'frames/f-00001.bob.html' },
            ],
          },
        ],
      },
    ];
    const flat = flattenFrames(steps);
    expect(flat[0]?.views?.map((v) => v.nodeId)).toEqual(['alice', 'bob']);
  });
});

describe('diffBySha', () => {
  test('identical hashes → no changes', () => {
    const d = diffBySha('abc', 'abc');
    expect(d?.identical).toBe(true);
    expect(diffBySha('xyz', 'xyz')).toBe(d);
  });
  test('missing prev → empty identical false when only next', () => {
    const d = diffBySha(undefined, 'abc');
    expect(d?.identical).toBe(false);
    expect(diffBySha(undefined, 'xyz')).toBe(d);
  });
  test('different hashes → null (compute full diff)', () => {
    expect(diffBySha('a', 'b')).toBeNull();
  });
});

describe('diffSqliteDatabases', () => {
  test('detects added table and rows', async () => {
    const { Database } = await import('bun:sqlite');
    const { diffSqliteDatabases } = await import('./sql/sqlite-diff');

    const prev = wrapBunDb(new Database(':memory:'), (db) => {
      db.run('CREATE TABLE items (id INTEGER, name TEXT)');
      db.run("INSERT INTO items VALUES (1, 'a')");
    });
    const next = wrapBunDb(new Database(':memory:'), (db) => {
      db.run('CREATE TABLE items (id INTEGER, name TEXT)');
      db.run('CREATE TABLE extra (id INTEGER)');
      db.run("INSERT INTO items VALUES (1, 'a')");
      db.run("INSERT INTO items VALUES (2, 'b')");
    });
    const diff = diffSqliteDatabases(prev as never, next as never);
    expect(diff.identical).toBe(false);
    expect(diff.schema.addedTables).toEqual(['extra']);
    const items = diff.tables.find((t) => t.table === 'items');
    expect(items?.prevCount).toBe(1);
    expect(items?.nextCount).toBe(2);
    expect(items?.rows.some((r) => r.kind === 'added')).toBe(true);
  });
});

type BunDb = import('bun:sqlite').Database;

/** Minimal sqlite-wasm-shaped exec adapter over bun:sqlite for unit tests. */
function wrapBunDb(
  db: BunDb,
  seed: (db: BunDb) => void
): { exec(opts: Record<string, unknown>): void } {
  seed(db);
  return {
    exec(opts) {
      const sql = String(opts['sql'] ?? '');
      const rowMode = opts['rowMode'] === 'object' ? 'object' : 'array';
      const callback = opts['callback'] as ((row: unknown) => void) | undefined;
      const stmt = db.query(sql);
      const rows = rowMode === 'object' ? stmt.all() : stmt.values();
      for (const row of rows) callback?.(row);
    },
  };
}
