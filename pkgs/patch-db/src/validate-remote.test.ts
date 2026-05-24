/**
 * Trust-boundary tests for the wire response validators. Phase 5 widens
 * `PatchDbResult` with an optional `metrics` field; the read-wire validator
 * must (a) accept it when present, (b) accept its absence (back-compat),
 * and (c) reject malformed shapes.
 */
import { assert } from '@pkgs/assert';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assertWireReadResponse } from './validate-remote';

let dispose: () => void;
beforeAll(() => {
  dispose = assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
});
afterAll(() => {
  dispose();
});

function baseResult(extra?: Record<string, unknown>): unknown {
  return {
    query: { entityType: 'task' },
    entities: [],
    patches: [],
    total: 0,
    hasMore: false,
    nextCursor: null,
    ...extra,
  };
}

describe('assertWireReadResponse: optional metrics', () => {
  test('accepts response without metrics (back-compat)', () => {
    expect(() =>
      assertWireReadResponse({ results: [baseResult()] })
    ).not.toThrow();
  });

  test('accepts well-formed metrics with elapsedMs + sortIndex', () => {
    expect(() =>
      assertWireReadResponse({
        results: [
          baseResult({
            metrics: {
              elapsedMs: 12.5,
              sortIndex: 3,
            },
          }),
        ],
      })
    ).not.toThrow();
  });

  test('accepts metrics with optional partition + plan fields', () => {
    expect(() =>
      assertWireReadResponse({
        results: [
          baseResult({
            metrics: {
              elapsedMs: 1,
              sortIndex: 0,
              partition: 'snapshots__chess_puzzle',
              plan: { 'Plan': { Node: 'Index Scan' } },
            },
          }),
        ],
      })
    ).not.toThrow();
  });

  test('rejects metrics with non-numeric elapsedMs', () => {
    expect(() =>
      assertWireReadResponse({
        results: [
          baseResult({
            metrics: { elapsedMs: '12.5', sortIndex: 0 },
          }),
        ],
      })
    ).toThrow();
  });

  test('rejects metrics missing sortIndex', () => {
    expect(() =>
      assertWireReadResponse({
        results: [
          baseResult({
            metrics: { elapsedMs: 1.0 },
          }),
        ],
      })
    ).toThrow();
  });

  test('rejects metrics with non-string partition', () => {
    expect(() =>
      assertWireReadResponse({
        results: [
          baseResult({
            metrics: { elapsedMs: 1, sortIndex: 0, partition: 42 },
          }),
        ],
      })
    ).toThrow();
  });
});
