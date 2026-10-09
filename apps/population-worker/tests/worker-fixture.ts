import {
  createWorkerRpc,
  type WorkerAssignment,
} from '@apps/population-worker/worker-rpc';
import { DEFAULT_POPULATION_CONFIG } from '@libs/population-shared/config';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createNoopLogger } from '@pkgs/logger-shared/logger';
import type { IsolatedWorker } from '@pkgs/os-server/wall-isolated-worker';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';
import { Hono } from 'hono';

export class ControlledRealm implements IsolatedWorker {
  readonly messages: unknown[] = [];
  terminated = false;
  private readonly listeners = new Set<(value: unknown) => void>();
  private readonly errors = new Set<(message: string) => void>();
  post(value: unknown) {
    this.messages.push(value);
  }
  subscribe(listener: (value: unknown) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  onError(listener: (message: string) => void) {
    this.errors.add(listener);
    return () => this.errors.delete(listener);
  }
  emit(value: unknown) {
    for (const listener of this.listeners) listener(value);
  }
  fail() {
    for (const listener of this.errors) listener('realm interrupted');
  }
  terminate() {
    this.terminated = true;
  }
}

export function workerFixture() {
  const { clock, timers } = createHarnessClock({
    startMs: Date.UTC(2026, 0, 1),
  });
  const { createId } = createHarnessIds(812);
  const assignment: WorkerAssignment = {
    lease: {
      userId: createId(),
      workerId: createId(),
      generation: 1,
      expiresAt: new Date(clock.now() + 60_000).toISOString(),
    },
    username: 'Cedar',
    email: 'cedar@synthetic.invalid',
    password: createId(),
    registered: true,
    deviceId: createId(),
    checkpoint: null,
    config: { ...DEFAULT_POPULATION_CONFIG, desired: 1 },
  };
  let claimed = false;
  const calls: string[] = [];
  let release: (() => void) | undefined;
  let holdRelease = false;
  let renewStatus = 200;
  const server = new Hono().post(
    '/api/population-worker/:action',
    async (c) => {
      const action = c.req.param('action');
      calls.push(action);
      if (action === 'heartbeat') return c.json({ config: assignment.config });
      if (action === 'claim') {
        const value = claimed ? null : assignment;
        claimed = true;
        return c.json({ assignment: value });
      }
      if (action === 'renew')
        return renewStatus === 200
          ? c.json({
              renewal: {
                expiresAt: assignment.lease.expiresAt,
                paused: false,
                inspectionRequestedAt: null,
                commands: [],
                config: assignment.config,
                draining: false,
              },
            })
          : c.json({ error: 'expired' }, 409);
      if (action === 'release' && holdRelease)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      return c.json({ accepted: true, released: true });
    }
  );
  return {
    assignment,
    calls,
    clock,
    timers,
    log: createNoopLogger(),
    rpc: createWorkerRpc('http://localhost', 'fixture', async (input, init) =>
      server.fetch(new Request(input, init))
    ),
    blockRelease: () => {
      holdRelease = true;
    },
    release: () => release?.(),
    refuseRenewal: () => {
      renewStatus = 409;
    },
  };
}

export async function settleWorker(): Promise<void> {
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
}
