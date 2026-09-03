import fc from 'fast-check';
import { gen } from '../../fast-check';
import { defineSystem } from '../../index';
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
  generate(session, knobs: KvKnobs) {
    const server = startServer(session.fork('server'));
    const clientList = range(knobs.clients).map((i) =>
      startClient(session.fork(`client:${i}`), server)
    );
    return { session, server, clients: clientList } satisfies KvSurface;
  },
});

const { defineAction, defineProperty } = kv;

export function clientIds(s: KvSurface): string[] {
  return s.clients.map((c) => c.id);
}

export function serverHash(s: KvSurface): string {
  return storeFingerprint(s.server.store);
}

export function clientHash(s: KvSurface): string[] {
  return s.clients.map((c) => storeFingerprint(c.cache));
}

export function quiet(s: KvSurface): boolean {
  return s.session.network.inFlight() === 0;
}

export function converged(s: KvSurface): boolean {
  const server = serverHash(s);
  return clientHash(s).every((c) => c === server);
}

export function caps(s: KvSurface): string[] {
  return [...s.session.caps];
}

export function partitioned(s: KvSurface): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

export const put = defineAction({
  name: 'put',
  enabled: (s) => s.clients.length > 0,
  weight: 3,
  args: (s) =>
    gen(
      fc.tuple(
        fc.constantFrom(...s.clients.map((c) => c.id)),
        fc.string({ minLength: 1, maxLength: 8 }),
        fc.string({ maxLength: 16 })
      )
    ),
  act: (s, client: string, key: string, value: string) => {
    const c = s.clients.find((x) => x.id === client);
    if (c === undefined) return;
    sendPut({ server: s.server, client: c, key, value });
  },
});

export const partition = defineAction({
  name: 'partition',
  enabled: (s) =>
    caps(s).includes('partition') && s.clients.length > 0,
  weight: (s) => (partitioned(s).length === 0 ? 2 : 1),
  args: (s) => gen(fc.constantFrom(...s.clients.map((c) => c.id))),
  act: (s, id: string) => {
    s.session.network.partition('server', id);
  },
});

export const heal = defineAction({
  name: 'heal',
  enabled: (s) => caps(s).includes('partition'),
  weight: (s) => Math.max(partitioned(s).length, 0),
  act: (s) => {
    s.session.network.healAll();
    rebroadcastStore(s.server);
  },
});

export const outage = defineAction({
  name: 'outage',
  enabled: (s) =>
    caps(s).includes('partition') && s.clients.length > 0,
  weight: 1,
  args: (s) => gen(fc.constantFrom(...s.clients.map((c) => c.id))),
  act: async (s, id: string) => {
    s.session.network.partition('server', id);
    await s.session.elapse(Math.floor(s.session.ports.rng.next() * 5_000));
    s.session.network.healAll();
    rebroadcastStore(s.server);
  },
});

export const KV_ACTIONS = [put, partition, heal, outage] as const;

export const converges = defineProperty({
  name: 'converges',
  check: (s) => {
    if (quiet(s) && partitioned(s).length === 0 && !converged(s)) {
      throw new Error(
        `quiet but diverged: server ${String(serverHash(s))}, clients ${String(clientHash(s))}`
      );
    }
  },
});

export const KV_PROPERTIES = [converges];

export const arbKvKnobs = (): fc.Arbitrary<KvKnobs> =>
  fc.record({ clients: fc.integer({ min: 1, max: 3 }) });

export type { KvSurface };
