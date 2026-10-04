import { describe, expect, test } from 'bun:test';
import type { Clock, Timers } from '@pkgs/clock-shared/types';

import { gateFetchUntilAvailable } from '@pkgs/http-client-shared/gate-fetch-until-available';
import { HttpNetworkError } from '@pkgs/http-client-shared/http-network-error';
import { createHealthOriginAvailability } from '@pkgs/http-client-shared/origin-availability';
import type { HttpFetch } from '@pkgs/http-client-shared/types';

const HEALTH = 'http://localhost:8788/api/health';
const SESSION = 'http://localhost:8788/api/auth/get-session';
const OTHER = 'https://example.test/v1';

function jsonOk(): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function createManualTimers(): {
  readonly timers: Timers;
  fireNext(): void;
  pendingCount(): number;
} {
  const pending: { id: number; fn: () => void }[] = [];
  let nextId = 1;
  return {
    timers: {
      setTimeout: (fn) => {
        const id = nextId;
        nextId += 1;
        pending.push({ id, fn });
        return id;
      },
      clearTimeout: (handle) => {
        const index = pending.findIndex((item) => item.id === handle);
        if (index >= 0) pending.splice(index, 1);
      },
      setInterval: () => 0,
      clearInterval: () => undefined,
    },
    fireNext: () => {
      const item = pending.shift();
      item?.fn();
    },
    pendingCount: () => pending.length,
  };
}

function createClock(): Clock {
  let now = 0;
  return {
    now: () => {
      now += 1;
      return now;
    },
  };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    if (predicate()) return;
    await flush();
  }
  throw new Error('waitFor timed out');
}

describe('createHealthOriginAvailability', () => {
  test('while down, inner fetch is health-only', async () => {
    const calls: string[] = [];
    const fetchFn: HttpFetch = async (input) => {
      calls.push(String(input));
      throw new HttpNetworkError('down');
    };
    const { timers } = createManualTimers();
    const availability = createHealthOriginAvailability({
      healthUrl: HEALTH,
      fetch: fetchFn,
      timers,
      clock: createClock(),
    });
    const gated = gateFetchUntilAvailable({ fetch: fetchFn, availability });
    availability.start();
    await waitFor(() => availability.getSnapshot().phase === 'unavailable');
    const parked = gated(SESSION);
    await flush();
    expect(calls).toEqual([HEALTH]);
    expect(availability.getSnapshot().phase).not.toBe('available');
    availability.stop();
    await expect(parked).rejects.toBeInstanceOf(Error);
  });

  test('waiters resolve after a successful probe', async () => {
    const calls: string[] = [];
    let healthOk = false;
    const fetchFn: HttpFetch = async (input) => {
      const href = String(input);
      calls.push(href);
      if (href === HEALTH) {
        if (!healthOk) throw new HttpNetworkError('down');
        return jsonOk();
      }
      return new Response(null, { status: 200 });
    };
    const { timers, fireNext, pendingCount } = createManualTimers();
    const availability = createHealthOriginAvailability({
      healthUrl: HEALTH,
      fetch: fetchFn,
      timers,
      clock: createClock(),
    });
    const gated = gateFetchUntilAvailable({ fetch: fetchFn, availability });
    availability.start();
    await waitFor(() => pendingCount() === 1);
    const parked = gated(SESSION);
    healthOk = true;
    fireNext();
    await flush();
    const response = await parked;
    expect(response.status).toBe(200);
    expect(calls.filter((href) => href === SESSION)).toEqual([SESSION]);
    expect(availability.getSnapshot().phase).toBe('available');
    availability.stop();
  });

  test('a later network error returns to probing', async () => {
    let healthOk = true;
    const fetchFn: HttpFetch = async (input) => {
      if (String(input) === HEALTH) {
        if (!healthOk) throw new HttpNetworkError('down');
        return jsonOk();
      }
      throw new HttpNetworkError('dropped');
    };
    const { timers } = createManualTimers();
    const availability = createHealthOriginAvailability({
      healthUrl: HEALTH,
      fetch: fetchFn,
      timers,
      clock: createClock(),
    });
    const gated = gateFetchUntilAvailable({ fetch: fetchFn, availability });
    availability.start();
    await waitFor(() => availability.getSnapshot().phase === 'available');
    healthOk = false;
    await expect(gated(SESSION)).rejects.toBeInstanceOf(HttpNetworkError);
    await waitFor(() => availability.getSnapshot().phase !== 'available');
    expect(availability.getSnapshot().phase).not.toBe('available');
    availability.stop();
  });

  test('does not open after N failures — still recovers on health ok', async () => {
    let healthOk = false;
    let healthCalls = 0;
    const fetchFn: HttpFetch = async (input) => {
      if (String(input) !== HEALTH) {
        if (!healthOk) throw new Error('origin request while down');
        return new Response(null, { status: 200 });
      }
      healthCalls += 1;
      if (!healthOk) throw new HttpNetworkError('down');
      return jsonOk();
    };
    const { timers, fireNext, pendingCount } = createManualTimers();
    const availability = createHealthOriginAvailability({
      healthUrl: HEALTH,
      fetch: fetchFn,
      timers,
      clock: createClock(),
      initialBackoffMs: 1,
      maxBackoffMs: 8,
    });
    const gated = gateFetchUntilAvailable({ fetch: fetchFn, availability });
    availability.start();
    await waitFor(() => pendingCount() === 1);
    const parked = gated(SESSION);
    for (let i = 0; i < 8; i += 1) {
      fireNext();
      await waitFor(() => pendingCount() === 1);
    }
    expect(healthCalls).toBeGreaterThan(3);
    expect(availability.getSnapshot().phase).not.toBe('available');
    healthOk = true;
    fireNext();
    await flush();
    const response = await parked;
    expect(response.status).toBe(200);
    availability.stop();
  });

  test('other origins bypass the gate while down', async () => {
    const calls: string[] = [];
    const fetchFn: HttpFetch = async (input) => {
      calls.push(String(input));
      if (String(input) === HEALTH) throw new HttpNetworkError('down');
      return new Response(null, { status: 204 });
    };
    const { timers } = createManualTimers();
    const availability = createHealthOriginAvailability({
      healthUrl: HEALTH,
      fetch: fetchFn,
      timers,
      clock: createClock(),
    });
    const gated = gateFetchUntilAvailable({ fetch: fetchFn, availability });
    availability.start();
    await waitFor(() => availability.getSnapshot().phase === 'unavailable');
    const response = await gated(OTHER);
    expect(response.status).toBe(204);
    expect(calls).toContain(OTHER);
    availability.stop();
  });
});
