import { Assert } from '@pkgs/assert';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client/interface';
import {
  assertExplainHasNoSeqScan,
  resolveExplainGuardMode,
} from './explain-guard';

type StubExplainRow = { 'QUERY PLAN': string };

function stubSqlClient(plan: object): SqlClient {
  const stub: Pick<SqlClient, 'query'> = {
    query: async <T>(_sql: string, _params?: unknown): Promise<T[]> => {
      void _sql;
      void _params;
      const row: StubExplainRow = { 'QUERY PLAN': JSON.stringify([plan]) };
      return [row] as unknown as T[];
    },
  } as Pick<SqlClient, 'query'>;
  return stub as SqlClient;
}

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});

afterAll(() => {
  disposeTestCrashHandler();
});

describe('assertExplainHasNoSeqScan', () => {
  test('mode=off is a no-op even with a Seq Scan on a guarded table', async () => {
    const client = stubSqlClient({
      Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'snapshots' },
    });
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], { mode: 'off' })
    ).resolves.toBeUndefined();
  });

  test('crash on Seq Scan against base table snapshots', async () => {
    const client = stubSqlClient({
      Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'snapshots' },
    });
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], { mode: 'crash' })
    ).rejects.toThrow(/Seq Scan on patch-db relation/);
  });

  test('crash on Seq Scan against partition snapshots_chess_puzzle', async () => {
    const client = stubSqlClient({
      Plan: {
        'Node Type': 'Seq Scan',
        'Relation Name': 'snapshots_chess_puzzle',
      },
    });
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], { mode: 'crash' })
    ).rejects.toThrow(/snapshots_chess_puzzle/);
  });

  test('passes when the plan uses an Index Scan on snapshots', async () => {
    const client = stubSqlClient({
      Plan: {
        'Node Type': 'Index Scan',
        'Relation Name': 'snapshots',
        Plans: [],
      },
    });
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], { mode: 'crash' })
    ).resolves.toBeUndefined();
  });

  test('passes when the Seq Scan is on a non-guarded relation', async () => {
    const client = stubSqlClient({
      Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'some_other_table' },
    });
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], { mode: 'crash' })
    ).resolves.toBeUndefined();
  });

  test('detects nested Seq Scan deep in the plan tree', async () => {
    const client = stubSqlClient({
      Plan: {
        'Node Type': 'Limit',
        Plans: [
          {
            'Node Type': 'Sort',
            Plans: [
              {
                'Node Type': 'Seq Scan',
                'Relation Name': 'patches',
              },
            ],
          },
        ],
      },
    });
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], { mode: 'crash' })
    ).rejects.toThrow(/Seq Scan on patch-db relation/);
  });

  test('mode=warn does not throw but reports', async () => {
    const client = stubSqlClient({
      Plan: { 'Node Type': 'Seq Scan', 'Relation Name': 'snapshots' },
    });
    let warned: { message: string; ctx: unknown } | null = null;
    const logger = {
      info: () => undefined,
      warn: (message: string, ctx: unknown) => {
        warned = { message, ctx };
      },
      error: () => undefined,
      debug: () => undefined,
      trace: () => undefined,
      fatal: () => undefined,
      child: () => logger,
    } as unknown as NonNullable<
      Parameters<typeof assertExplainHasNoSeqScan>[3]['logger']
    >;
    await expect(
      assertExplainHasNoSeqScan(client, 'SELECT 1', [], {
        mode: 'warn',
        logger,
      })
    ).resolves.toBeUndefined();
    expect(warned).not.toBeNull();
  });
});

describe('resolveExplainGuardMode', () => {
  test('env override beats option', () => {
    expect(
      resolveExplainGuardMode('off', { PATCH_DB_EXPLAIN_GUARD: '1' })
    ).toBe('crash');
    expect(
      resolveExplainGuardMode('crash', { PATCH_DB_EXPLAIN_GUARD: '0' })
    ).toBe('off');
    expect(
      resolveExplainGuardMode('off', { PATCH_DB_EXPLAIN_GUARD: 'warn' })
    ).toBe('warn');
  });

  test('falls back to option when env is unset', () => {
    expect(resolveExplainGuardMode('warn', {})).toBe('warn');
  });

  test('defaults to off', () => {
    expect(resolveExplainGuardMode(undefined, {})).toBe('off');
  });

  test('ignores unrecognized env values, falls back to option', () => {
    expect(
      resolveExplainGuardMode('warn', { PATCH_DB_EXPLAIN_GUARD: 'yolo' })
    ).toBe('warn');
  });
});
