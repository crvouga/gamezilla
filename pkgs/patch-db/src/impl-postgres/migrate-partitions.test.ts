/**
 * Pure-helper tests for {@link generatedColumnExpression} + {@link quoteSqlString}.
 *
 * Integration tests that actually create / drop partitions + generated
 * columns + per-partition btrees live in the postgres harness (see
 * `migrate-reconcile-pg.integration.test.ts`) — those exercise
 * {@link migratePatchDbPostgres} end-to-end against a real cluster. Here
 * we lock down the SQL expression shape that the reconciler emits so a
 * regression in the formatter shows up immediately.
 */
import { asKeyword } from '@pkgs/keyword';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert';

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
import {
  generatedColumnExpression,
  quoteSqlString,
} from './migrate-partitions';

describe('quoteSqlString', () => {
  test('wraps identifiers in single quotes', () => {
    expect(quoteSqlString('chess.puzzle')).toBe(`'chess.puzzle'`);
  });

  test('escapes embedded single quotes by doubling them', () => {
    expect(quoteSqlString(`bobby'); DROP`)).toBe(`'bobby''); DROP'`);
  });
});

describe('generatedColumnExpression', () => {
  test('text columns omit the explicit cast', () => {
    const expr = generatedColumnExpression({
      attribute: asKeyword('task/status'),
      columnName: 'gc_status',
      dataType: 'text',
      nullable: false,
    });
    expect(expr).toBe(`((attributes::jsonb ->> 'task/status'))`);
  });

  test('numeric columns cast through ::numeric so btrees are usable', () => {
    const expr = generatedColumnExpression({
      attribute: asKeyword('task/score'),
      columnName: 'gc_score',
      dataType: 'number',
      nullable: false,
    });
    expect(expr).toBe(`((attributes::jsonb ->> 'task/score')::numeric)`);
  });

  test('boolean columns cast through ::boolean', () => {
    const expr = generatedColumnExpression({
      attribute: asKeyword('task/done'),
      columnName: 'gc_done',
      dataType: 'boolean',
      nullable: false,
    });
    expect(expr).toBe(`((attributes::jsonb ->> 'task/done')::boolean)`);
  });

  test('attribute keys with embedded single quotes are escaped (defense in depth)', () => {
    // `asKeyword` rejects single quotes by design; cast to bypass the
    // type guard and exercise the formatter's escape path directly.
    const expr = generatedColumnExpression({
      attribute: `evil/'or'1'='1` as never,
      columnName: 'gc_evil',
      dataType: 'text',
      nullable: false,
    });
    expect(expr).toBe(`((attributes::jsonb ->> 'evil/''or''1''=''1'))`);
  });
});
