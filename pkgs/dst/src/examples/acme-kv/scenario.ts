import fc from 'fast-check';
import { gen } from '../../fast-check';
import { defineSystem, draw, observe } from '../../index';
import { rebroadcastStore, sendPut, startClient, startServer } from './nodes';
import type { KvSurface } from './surface';
import { storeFingerprint } from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export type KvKnobs = {
  readonly clients: number;
};

/** Toy multi-client KV — knobs topology, model network, fault actions. */
export const kv = defineSystem({
  name: 'acme-kv',
  *generate(session, knobs: KvKnobs) {
    const server = startServer(session.fork('server'));
    const clientList = range(knobs.clients).map((i) =>
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
    const o = yield* observe({ serverHash, clientHash });
    return o.clientHash.every((c) => c === o.serverHash);
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
  generate(client: string, key: string, value: string) {
    return {
      weight: 3,
      act: (s) => {
        const c = s.clients.find((x) => x.id === client);
        if (c === undefined) return;
        sendPut({ server: s.server, client: c, key, value });
      },
    };
  },
});

/** Random pool member — draws then delegates to typed {@link put}. */
export const randomPut = defineAction({
  name: 'randomPut',
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
    yield* put(client, key, value);
  },
});

export const partition = defineAction({
  name: 'partition',
  generate(id: string) {
    return (s) => {
      s.session.network.partition('server', id);
    };
  },
});

export const randomPartition = defineAction({
  name: 'randomPartition',
  *generate() {
    const o = yield* observe({ caps, clientIds, partitioned });
    if (!o.caps.includes('partition') || o.clientIds.length === 0) return;
    const id = yield* draw(
      (rng) => o.clientIds[Math.floor(rng.next() * o.clientIds.length)]!
    );
    yield {
      weight: o.partitioned.length === 0 ? 2 : 1,
      act: (s) => {
        s.session.network.partition('server', id);
      },
    };
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    const o = yield* observe({ caps, partitioned });
    if (!o.caps.includes('partition')) return;
    yield {
      weight: o.partitioned.length,
      act: (s) => {
        s.session.network.healAll();
        rebroadcastStore(s.server);
      },
    };
  },
});

export const passTime = defineAction({
  name: 'passTime',
  generate(ms: number) {
    return (s) => s.session.scheduler.advance(ms);
  },
});

export const randomPassTime = defineAction({
  name: 'randomPassTime',
  *generate() {
    if (!(yield* caps).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield* passTime(ms);
  },
});

export const outage = defineAction({
  name: 'outage',
  *generate() {
    yield* randomPartition;
    yield* randomPassTime;
    yield* heal;
  },
});

export const KV_ACTIONS = [
  randomPut,
  randomPartition,
  heal,
  randomPassTime,
  outage,
] as const;

export const converges = defineProperty({
  name: 'converges',
  *watch() {
    const o = yield* observe({
      quiet,
      converged,
      cut: partitioned,
      serverHash,
      clientHash,
    });
    if (o.quiet && o.cut.length === 0 && !o.converged) {
      throw new Error(
        `quiet but diverged: server ${String(o.serverHash)}, clients ${String(o.clientHash)}`
      );
    }
  },
});

export const KV_PROPERTIES = [converges];

export const arbKvKnobs = (): fc.Arbitrary<KvKnobs> =>
  fc.record({ clients: fc.integer({ min: 1, max: 3 }) });

export type { KvSurface };
