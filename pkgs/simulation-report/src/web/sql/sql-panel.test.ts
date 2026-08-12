import { describe, expect, test } from 'bun:test';
import { gunzipSync, gzipSync } from 'node:zlib';

import type { SimulationStep } from '../../types';
import { flattenFrames } from '../frames';
import { clearSqlHistory, listSqlHistory, pushSqlHistory } from './sql-history';

describe('sql history', () => {
  test('dedupes and caps per node', () => {
    clearSqlHistory();
    pushSqlHistory('server', 'SELECT 1', 1);
    pushSqlHistory('server', 'SELECT 2', 2);
    pushSqlHistory('server', 'SELECT 1', 3);
    const hist = listSqlHistory('server');
    expect(hist.map((h) => h.sql)).toEqual(['SELECT 1', 'SELECT 2']);
    clearSqlHistory('server');
    expect(listSqlHistory('server')).toEqual([]);
  });
});

describe('flattenFrames databases', () => {
  test('forwards frame databases metadata', () => {
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
            file: 'frames/f-00001.html',
            capturedAtMs: 5,
            durationMs: 5,
            databases: [
              {
                nodeId: 'server',
                file: 'frames/db/abc.sqlite.gz',
                sha256: 'abc',
                byteLength: 12,
              },
            ],
          },
        ],
      },
    ];
    const flat = flattenFrames(steps);
    expect(flat[0]?.databases?.[0]?.nodeId).toBe('server');
  });
});

describe('gzip round-trip', () => {
  test('gunzip recovers sqlite-looking bytes', () => {
    const raw = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const gz = gzipSync(raw);
    const out = gunzipSync(gz);
    expect([...out]).toEqual([...raw]);
  });
});

describe('diffBySha fast path', () => {
  test('equal sha is identical', async () => {
    const { diffBySha } = await import('./sqlite-diff');
    expect(diffBySha('deadbeef', 'deadbeef')?.identical).toBe(true);
  });
});
