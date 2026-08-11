import { describe, expect, test } from 'bun:test';
import {
  awaitRpcResponse,
  createRpcIdFactory,
  isLeaderLostError,
  leaderLostError,
  type PendingRpc,
  RPC_ERROR_TIMEOUT,
  rehydrateError,
  serializeError,
  serializeSql,
  settleRpcResponse,
} from './rpc';

describe('web rpc', () => {
  test('serializeSql copies sql + values (CloneSafe wire)', () => {
    const wire = serializeSql({
      sql: 'SELECT ?',
      values: [1, 'a', null],
    });
    expect(wire).toEqual({ sql: 'SELECT ?', values: [1, 'a', null] });
    expect(wire.values).not.toBe([1, 'a', null] as never);
  });

  test('error serialize / rehydrate preserves name, message, code, stack', () => {
    const original = leaderLostError('gone');
    original.stack = 'stack-line';
    const wire = serializeError(original);
    expect(wire.name).toBe('LeaderLostError');
    expect(wire.code).toBe('E_LEADER_LOST');
    const revived = rehydrateError(wire);
    expect(revived.name).toBe('LeaderLostError');
    expect(revived.message).toBe('gone');
    expect((revived as Error & { code?: string }).code).toBe('E_LEADER_LOST');
    expect(revived.stack).toBe('stack-line');
    expect(isLeaderLostError(revived)).toBe(true);
  });

  test('settleRpcResponse resolves and rejects pending entries', async () => {
    const pending = new Map<string, PendingRpc>();
    const timers = {
      clearTimeout: () => undefined,
    };
    const ok = new Promise<unknown>((resolve, reject) => {
      pending.set('1', { resolve, reject, timerId: 1 });
    });
    const bad = new Promise<unknown>((resolve, reject) => {
      pending.set('2', { resolve, reject, timerId: 2 });
    });
    settleRpcResponse(
      pending,
      { id: '1', ok: true, result: { role: 'owner' } },
      timers
    );
    settleRpcResponse(
      pending,
      {
        id: '2',
        ok: false,
        error: { name: 'Error', message: 'nope' },
      },
      timers
    );
    await expect(ok).resolves.toEqual({ role: 'owner' });
    await expect(bad).rejects.toMatchObject({ message: 'nope' });
  });

  test('createRpcIdFactory is monotonic', () => {
    const next = createRpcIdFactory('x');
    expect(next()).toBe('x_1');
    expect(next()).toBe('x_2');
  });

  test('awaitRpcResponse times out with E_TIMEOUT', async () => {
    const pending = new Map<string, PendingRpc>();
    const scheduled: Array<() => void> = [];
    const timers = {
      setTimeout: (fn: () => void, _ms: number) => {
        scheduled.push(fn);
        return 1;
      },
      clearTimeout: () => undefined,
    };
    const promise = awaitRpcResponse({
      id: 't1',
      op: 'query',
      pending,
      timers,
      timeoutMs: 10,
      send: () => undefined,
    });
    expect(pending.has('t1')).toBe(true);
    expect(scheduled).toHaveLength(1);
    scheduled[0]?.();
    await expect(promise).rejects.toMatchObject({
      code: RPC_ERROR_TIMEOUT,
    });
    expect(pending.has('t1')).toBe(false);
  });

  test('awaitRpcResponse cleans pending when send throws', async () => {
    const pending = new Map<string, PendingRpc>();
    let cleared = false;
    const timers = {
      setTimeout: (_fn: () => void) => {
        return 1;
      },
      clearTimeout: () => {
        cleared = true;
      },
    };
    const promise = awaitRpcResponse({
      id: 't2',
      op: 'run',
      pending,
      timers,
      send: () => {
        throw new Error('port closed');
      },
    });
    await expect(promise).rejects.toMatchObject({ message: 'port closed' });
    expect(pending.has('t2')).toBe(false);
    expect(cleared).toBe(true);
  });
});
