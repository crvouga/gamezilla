import { describe, expect, test } from 'bun:test';
import { createSeededRng } from '@pkgs/io';

import { createEventLog } from '../events';
import { createSimMesh } from '../network';

function createMesh(seed = 1) {
  const events = createEventLog({ now: () => 0 });
  const rng = createSeededRng(seed).fork('mesh');
  const timers: Array<() => void> = [];
  const mesh = createSimMesh({
    rng,
    events,
    now: () => 0,
    schedule: (fn) => {
      timers.push(fn);
    },
  });
  mesh.registerEdge('alice', 'server', 'http');
  mesh.registerEdge('alice', 'pubsub', 'pubsub');
  mesh.registerEdge('bob', 'pubsub', 'pubsub');
  return {
    mesh,
    events,
    timers,
    flush: () => {
      while (timers.length > 0) timers.shift()?.();
    },
  };
}

describe('SimMesh', () => {
  test('partition drops send', async () => {
    const { mesh, events } = createMesh();
    mesh.partition('alice', 'server');
    let delivered = false;
    const result = await mesh.send({
      from: 'alice',
      to: 'server',
      kind: 'http',
      hop: 'forward',
      deliver: () => {
        delivered = true;
      },
    });
    expect(result).toBe('partitioned');
    expect(delivered).toBe(false);
    expect(events.snapshot().some((e) => e.kind === 'edge.partition')).toBe(
      true
    );
  });

  test('asymmetric partition: forward ok, reverse down', async () => {
    const { mesh } = createMesh();
    mesh.partition('alice', 'server', { direction: 'to' });
    // hop alice→server uses stateFrom (ok); server→alice uses stateTo (down)
    const forward = await mesh.send({
      from: 'alice',
      to: 'server',
      kind: 'http',
      hop: 'forward',
      deliver: () => undefined,
    });
    expect(forward).toBe('delivered');
    const reverse = await mesh.send({
      from: 'server',
      to: 'alice',
      kind: 'http',
      hop: 'reverse',
      deliver: () => undefined,
    });
    expect(reverse).toBe('partitioned');
  });

  test('hold then release delivers FIFO', async () => {
    const { mesh } = createMesh();
    mesh.hold('alice', 'server');
    const order: number[] = [];
    const a = mesh.send({
      from: 'alice',
      to: 'server',
      kind: 'http',
      hop: 'forward',
      deliver: () => {
        order.push(1);
      },
    });
    const b = mesh.send({
      from: 'alice',
      to: 'server',
      kind: 'http',
      hop: 'forward',
      deliver: () => {
        order.push(2);
      },
    });
    expect(await a).toBe('held');
    expect(await b).toBe('held');
    await mesh.release('alice', 'server');
    expect(order).toEqual([1, 2]);
  });

  test('release reorder uses seed', async () => {
    async function run(seed: number): Promise<number[]> {
      const { mesh } = createMesh(seed);
      mesh.hold('alice', 'server');
      const order: number[] = [];
      for (let i = 0; i < 5; i += 1) {
        const n = i;
        void mesh.send({
          from: 'alice',
          to: 'server',
          kind: 'http',
          hop: 'forward',
          deliver: () => {
            order.push(n);
          },
        });
      }
      await mesh.release('alice', 'server', { reorder: true });
      return order;
    }
    const a = await run(42);
    const b = await run(42);
    const c = await run(99);
    expect(a).toEqual(b);
    expect(a).not.toEqual([0, 1, 2, 3, 4]);
    expect(c).not.toEqual(a);
  });

  test('drop rate records edge.drop', async () => {
    const { mesh, events } = createMesh(7);
    mesh.drop('alice', 'server', 1);
    const result = await mesh.send({
      from: 'alice',
      to: 'server',
      kind: 'http',
      hop: 'forward',
      deliver: () => undefined,
    });
    expect(result).toBe('dropped');
    expect(events.snapshot().some((e) => e.kind === 'edge.drop')).toBe(true);
  });

  test('failWith arms counter', () => {
    const { mesh, events } = createMesh();
    mesh.failWith('alice', 'server', 500, { times: 2 });
    expect(mesh.takeFailWith('alice', 'server')?.type).toBe('status');
    expect(mesh.takeFailWith('alice', 'server')?.type).toBe('status');
    expect(mesh.takeFailWith('alice', 'server')).toBeNull();
    expect(events.snapshot().some((e) => e.kind === 'edge.failWith')).toBe(
      true
    );
  });
});
