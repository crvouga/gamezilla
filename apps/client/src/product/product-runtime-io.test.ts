import { describe, expect, test } from 'bun:test';
import type { Clock, Timers } from '@pkgs/clock';
import { HttpNetworkError } from '@pkgs/http-client';
import type { Io } from '@pkgs/io';

import { resolveProductRuntime } from './product-runtime-io';

const API = 'http://localhost:8788';
const HEALTH = `${API}/api/health`;
const SESSION = `${API}/api/auth/get-session`;

function stubTimers(): Timers {
  return {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  };
}

function stubClock(): Clock {
  return { now: () => 1 };
}

function stubIo(fetchFn: Io['http']['fetch']): Io {
  return {
    clock: stubClock(),
    timers: stubTimers(),
    createId: () => 'id',
    random: () => 0,
    http: { fetch: fetchFn },
    seed: 1n,
  };
}

describe('resolveProductRuntime', () => {
  test('skips the origin gate when io is injected', () => {
    const injected = stubIo(async () => new Response(null, { status: 204 }));
    const wall = stubIo(async () => {
      throw new Error('wall fetch should not run');
    });
    const resolved = resolveProductRuntime({
      injectedIo: injected,
      wall,
      apiBaseUrl: API,
    });
    expect(resolved.io).toBe(injected);
    expect(resolved.availability.kind).toBe('always');
  });

  test('wraps wall fetch and probes health before origin traffic', async () => {
    const calls: string[] = [];
    const wall = stubIo(async (input) => {
      calls.push(String(input));
      throw new HttpNetworkError('down');
    });
    const resolved = resolveProductRuntime({
      injectedIo: undefined,
      wall,
      apiBaseUrl: API,
    });
    expect(resolved.availability.kind).toBe('health');
    expect(resolved.io).not.toBe(wall);
    resolved.availability.start();
    await Promise.resolve();
    await Promise.resolve();
    const parked = resolved.io.http.fetch(SESSION);
    await Promise.resolve();
    expect(calls).toEqual([HEALTH]);
    resolved.availability.stop();
    await expect(parked).rejects.toBeInstanceOf(Error);
  });
});
