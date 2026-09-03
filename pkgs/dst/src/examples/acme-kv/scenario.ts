import fc from 'fast-check';
import { gen } from '../../fast-check';
import { defineSystem, draw, observe } from '../../index';
import { rebroadcastStore, sendPut, startClient, startServer } from './nodes';
import type { KvSurface } from './surface';
import { storeFingerprint } from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

/** Toy multi-client KV — drawn topology, model network, fault actions. */
export const kv = defineSystem({
  name: 'acme-kv',
  *generate(session) {
    const clients = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
    const server = startServer(session.fork('server'));
    const clientList = range(clients).map((i) =>
      startClient(session.fork(`client:${i}`), server)
    );
    return { session, server, clients: clientList } satisfies KvSurface;
  },
});

const { defineObservation, defineAction, defineProperty } = kv;

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => s.clients.map((c) => c.id),
});

export const serverHash = defineObservation({
  name: 'serverHash',
  observe: (s) => storeFingerprint(s.server.store),
});

export const clientHash = defineObservation({
  name: 'clientHash',
  observe: (s) => s.clients.map((c) => storeFingerprint(c.cache)),
});

export const quiet = defineObservation({
  name: 'quiet',
  observe: (s) => s.session.network.inFlight() === 0,
});

export const converged = defineObservation({
  name: 'converged',
  *observe() {
    const [h, cs] = yield* observe(serverHash, clientHash);
    return cs.every((c) => c === h);
  },
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s) => s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const put = defineAction({
  name: 'put',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const { client, key, value } = yield* draw(
      gen(
        fc.record({
          client: fc.constantFrom(...ids),
          key: fc.string({ minLength: 1, maxLength: 8 }),
          value: fc.string({ maxLength: 16 }),
        })
      )
    );
    yield {
      weight: 3,
      act: (s: KvSurface) => {
        const c = s.clients.find((x) => x.id === client);
        if (c === undefined) return;
        sendPut({ server: s.server, client: c, key, value });
      },
    };
  },
});

export const partition = defineAction({
  name: 'partition',
  *generate() {
    const [c, ids, cut] = yield* observe(caps, clientIds, partitioned);
    if (!c.includes('partition') || ids.length === 0) {
      return;
    }
    const id = yield* draw((rng) => ids[Math.floor(rng.next() * ids.length)]!);
    yield {
      weight: cut.length === 0 ? 2 : 1,
      act: (s: KvSurface) => {
        s.session.network.partition('server', id);
      },
    };
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    const [c, cut] = yield* observe(caps, partitioned);
    if (!c.includes('partition')) return;
    yield {
      weight: cut.length,
      act: (s: KvSurface) => {
        s.session.network.healAll();
        rebroadcastStore(s.server);
      },
    };
  },
});

export const passTime = defineAction({
  name: 'passTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield {
      weight: 1,
      act: (s: KvSurface) => s.session.scheduler.advance(ms),
    };
  },
});

export const outage = defineAction({
  name: 'outage',
  *generate() {
    yield* partition;
    yield* passTime;
    yield* heal;
  },
});

export const KV_ACTIONS = [put, partition, heal, passTime, outage];

export const converges = defineProperty({
  name: 'converges',
  *watch() {
    while (true) {
      const [q, ok, cut, h, cs] = yield* observe(
        quiet,
        converged,
        partitioned,
        serverHash,
        clientHash
      );
      if (q && cut.length === 0 && !ok) {
        throw new Error(
          `quiet but diverged: server ${String(h)}, clients ${String(cs)}`
        );
      }
    }
  },
});

export const KV_PROPERTIES = [converges];

export type { KvSurface };
