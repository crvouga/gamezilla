import fc from 'fast-check';
import { gen } from '../../fast-check';
import { defineSystem, draw, observe } from '../../index';
import {
  createNoteOnClient,
  flushPending,
  rebroadcastNotes,
  startClient,
  startServer,
} from './nodes';
import type { SyncSurface } from './surface';
import { notesAgg } from './types';

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export type SyncKnobs = {
  readonly clients: number;
};

/**
 * Toy sync-shaped system: in-memory notes + pending uploads over the model
 * network (stands in for mutate / SELECT md5 aggregates — no real SQL).
 */
export const sync = defineSystem({
  name: 'acme-sync',
  *generate(session, knobs: SyncKnobs) {
    const server = startServer(session.fork('server'));
    const clientList = range(knobs.clients).map((i) =>
      startClient(session.fork(`client:${i}`), server)
    );
    return { session, server, clients: clientList } satisfies SyncSurface;
  },
});

const { defineObservation, defineAction, defineProperty } = sync;

export const clientIds = defineObservation({
  name: 'clientIds',
  observe: (s) => s.clients.map((c) => c.id),
});

export const pending = defineObservation({
  name: 'pending',
  observe: (s) => s.clients.map((c) => c.pending.length),
});

export const serverNotes = defineObservation({
  name: 'serverNotes',
  observe: (s) => notesAgg(s.server.notes),
});

export const clientNotes = defineObservation({
  name: 'clientNotes',
  observe: (s) => s.clients.map((c) => notesAgg(c.notes)),
});

export const quiet = defineObservation({
  name: 'quiet',
  *observe() {
    const p = yield* pending;
    return p.every((n) => n === 0);
  },
});

export const converged = defineObservation({
  name: 'converged',
  *observe() {
    const o = yield* observe({ serverNotes, clientNotes });
    return o.clientNotes.every((c) => c.h === o.serverNotes.h && c.n === o.serverNotes.n);
  },
});

export const caps = defineObservation({
  name: 'caps',
  observe: (s) => [...s.session.caps] as string[],
});

export const partitioned = defineObservation({
  name: 'partitioned',
  observe: (s) => s.session.network.partitions().map(([a, b]) => `${a}|${b}`),
});

export const createNote = defineAction({
  name: 'createNote',
  generate(client: string, body: string) {
    return {
      weight: 3,
      act: (s) => {
        const c = s.clients.find((x) => x.id === client);
        if (c === undefined) return;
        createNoteOnClient({
          server: s.server,
          client: c,
          id: s.session.ports.createId(),
          body,
        });
      },
    };
  },
});

export const randomCreateNote = defineAction({
  name: 'randomCreateNote',
  *generate() {
    const ids = yield* clientIds;
    if (ids.length === 0) return;
    const { client, body } = yield* draw(
      gen(
        fc.record({
          client: fc.constantFrom(...(ids as string[])),
          body: fc.string({ maxLength: 20 }),
        })
      )
    );
    yield* createNote(client, body);
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
    const o = yield* observe({ caps, clientIds });
    if (!o.caps.includes('partition') || o.clientIds.length === 0) return;
    const id = yield* draw(
      (rng) => o.clientIds[Math.floor(rng.next() * o.clientIds.length)]!
    );
    yield* partition(id);
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    if (!(yield* caps).includes('partition')) return;
    yield {
      weight: 2,
      act: (s) => {
        s.session.network.healAll();
        rebroadcastNotes(s.server);
        for (const c of s.clients) flushPending(s.server, c);
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
    const o = yield* observe({ caps, pending });
    if (!o.caps.includes('virtualTime')) return;
    const pendingTotal = o.pending.reduce((a, b) => a + b, 0);
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield {
      weight: 1 + pendingTotal,
      act: (s) => s.session.scheduler.advance(ms),
    };
  },
});

export const SYNC_ACTIONS = [
  randomCreateNote,
  randomPartition,
  heal,
  randomPassTime,
] as const;

export const converges = defineProperty({
  name: 'converges',
  *watch() {
    const o = yield* observe({ quiet, converged, cut: partitioned });
    if (o.quiet && o.cut.length === 0 && !o.converged) {
      throw new Error('quiet but diverged');
    }
  },
});

export const SYNC_PROPERTIES = [converges];

export const arbSyncKnobs = (): fc.Arbitrary<SyncKnobs> =>
  fc.record({ clients: fc.integer({ min: 1, max: 3 }) });

export type { SyncSurface };
