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

/**
 * Toy sync-shaped system: in-memory notes + pending uploads over the model
 * network (stands in for mutate / SELECT md5 aggregates — no real SQL).
 */
export const sync = defineSystem({
  name: 'acme-sync',
  *generate(session) {
    const clients = yield* draw(gen(fc.integer({ min: 1, max: 3 })));
    const server = startServer(session.fork('server'));
    const clientList = range(clients).map((i) =>
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
    const [sv, cs] = yield* observe(serverNotes, clientNotes);
    return cs.every((c) => c.h === sv.h && c.n === sv.n);
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
    yield {
      weight: 3,
      act: (s: SyncSurface) => {
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

export const partition = defineAction({
  name: 'partition',
  *generate() {
    const [c, ids] = yield* observe(caps, clientIds);
    if (
      !(c as string[]).includes('partition') ||
      (ids as string[]).length === 0
    ) {
      return;
    }
    const id = yield* draw(
      (rng) =>
        (ids as string[])[Math.floor(rng.next() * (ids as string[]).length)]!
    );
    yield {
      weight: 2,
      act: (s: SyncSurface) => {
        s.session.network.partition('server', id);
      },
    };
  },
});

export const heal = defineAction({
  name: 'heal',
  *generate() {
    if (!(yield* caps).includes('partition')) return;
    yield {
      weight: 2,
      act: (s: SyncSurface) => {
        s.session.network.healAll();
        rebroadcastNotes(s.server);
        for (const c of s.clients) flushPending(s.server, c);
      },
    };
  },
});

export const passTime = defineAction({
  name: 'passTime',
  *generate() {
    const [c, p] = yield* observe(caps, pending);
    if (!(c as string[]).includes('virtualTime')) return;
    const ms = yield* draw((rng) => Math.floor(rng.next() * 5_000));
    yield {
      weight: 1 + (p as number[]).reduce((a, b) => a + b, 0),
      act: (s: SyncSurface) => s.session.scheduler.advance(ms),
    };
  },
});

export const SYNC_ACTIONS = [createNote, partition, heal, passTime];

export const converges = defineProperty({
  name: 'converges',
  *watch() {
    while (true) {
      const [q, ok, cut] = (yield observe(quiet, converged, partitioned)) as [
        boolean,
        boolean,
        string[],
      ];
      if (q && cut.length === 0 && !ok) {
        throw new Error('quiet but diverged');
      }
    }
  },
});

export const SYNC_PROPERTIES = [converges];

export type { SyncSurface };
