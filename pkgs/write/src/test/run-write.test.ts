import { describe, expect, test } from 'bun:test';

import { defineWrite } from '../shared/define-write';
import { ok, fail } from '../shared/write-result';
import { runWrite } from '../shared/run-write';
import type { WriteContext } from '../shared/write-context';
import { createInMemoryWriteStore } from './in-memory-write-store';
import {
  createRowEvaluator,
  createRowWriteBinding,
  createRowWriteRegistry,
  defineRowAuthorizeWrite,
  denyAllRowBinding,
  type RowWriteBinding,
} from '../server/row-write-registry';
import type { RowChange } from '../shared/row-change';
import { idMatches } from '../shared/read-row-values';

const ctx: WriteContext = {
  subjectId: 'user-1',
  deviceId: 'device-1',
  accountId: 'user-1',
  myId: 'user-1',
  isAnonymous: false,
  memberOfSpaceIds: [],
};

describe('runWrite', () => {
  test('runs authorize and execute on success', async () => {
    const write = defineWrite({
      name: 'test.echo',
      parseInput: (raw) =>
        typeof raw === 'string'
          ? ok(raw)
          : fail('BAD_INPUT', 'expected string'),
      authorize: async () => ok(undefined),
      execute: async (_ctx, input) => ok(`done:${input}`),
    });
    const result = await runWrite({
      write,
      ctx,
      rawInput: 'hello',
      store: createInMemoryWriteStore(),
      mode: 'full',
    });
    expect(result).toEqual({ ok: true, value: 'done:hello' });
  });

  test('short-circuits on authorize failure', async () => {
    const write = defineWrite({
      name: 'test.deny',
      parseInput: (raw) => ok(String(raw)),
      authorize: async () => fail('DENIED', 'nope'),
      execute: async () => ok('never'),
    });
    const result = await runWrite({
      write,
      ctx,
      rawInput: 'x',
      store: createInMemoryWriteStore(),
      mode: 'full',
    });
    expect(result).toEqual({ ok: false, code: 'DENIED', message: 'nope' });
  });
});

describe('createRowEvaluator', () => {
  test('accepts authorized row', async () => {
    const registry = createRowWriteRegistry({
      widgets: createRowWriteBinding(
        defineRowAuthorizeWrite({
          name: 'widgets.patch',
          authorize: async (writeCtx, row) => {
            const mismatch = idMatches(
              row.id,
              writeCtx.myId,
              'WIDGET_ID_MISMATCH'
            );
            return mismatch ?? ok(undefined);
          },
        })
      ) as RowWriteBinding<RowChange>,
    });
    const evaluate = createRowEvaluator(registry);
    const result = await evaluate(
      ctx,
      { op: 'patch', table: 'widgets', id: 'user-1', values: { color: 'red' } },
      createInMemoryWriteStore()
    );
    expect(result).toEqual({ status: 'accepted' });
  });

  test('rejects unknown table', async () => {
    const evaluate = createRowEvaluator(createRowWriteRegistry({}));
    const result = await evaluate(
      ctx,
      { op: 'patch', table: 'missing', id: '1' },
      createInMemoryWriteStore()
    );
    expect(result).toEqual({ status: 'rejected', code: 'NO_WRITE_FOR_TABLE' });
  });

  test('rejects deny-all binding', async () => {
    const registry = createRowWriteRegistry({
      secrets: denyAllRowBinding('SERVER_MANAGED'),
    });
    const evaluate = createRowEvaluator(registry);
    const result = await evaluate(
      ctx,
      { op: 'put', table: 'secrets', id: '1' },
      createInMemoryWriteStore()
    );
    expect(result).toEqual({ status: 'rejected', code: 'SERVER_MANAGED' });
  });
});
