import fc from 'fast-check';
import { gen } from '../../fast-check';
import { defineSystem, virtualHost } from '../../index';
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

export type SyncArgs = {
  readonly clients: number;
};

/**
 * Toy sync-shaped system: in-memory notes + pending uploads over the model
 * network (stands in for mutate / SELECT md5 aggregates — no real SQL).
 */
export const sync = defineSystem({
  name: 'acme-sync',
  args: { clients: 2 },
  draw: () => gen(fc.record({ clients: fc.integer({ min: 1, max: 3 }) })),
  create(session, args: SyncArgs) {
    const server = startServer(session.fork('server'));
    const clientList = range(args.clients).map((i) =>
      startClient(session.fork(`client:${i}`), server)
    );
    return { session, server, clients: clientList } satisfies SyncSurface;
  },
});

sync.host({
  default: true,
  name: 'virtual',
  create: () => virtualHost(),
});

export function clientIds(s: SyncSurface): string[] {
  return s.clients.map((c) => c.id);
}

export function pending(s: SyncSurface): number[] {
  return s.clients.map((c) => c.pending.length);
}

export function serverNotes(s: SyncSurface) {
  return notesAgg(s.server.notes);
}

export function clientNotes(s: SyncSurface) {
  return s.clients.map((c) => notesAgg(c.notes));
}

export function quiet(s: SyncSurface): boolean {
  return pending(s).every((n) => n === 0);
}

export function converged(s: SyncSurface): boolean {
  const server = serverNotes(s);
  return clientNotes(s).every((c) => c.h === server.h && c.n === server.n);
}

export function caps(s: SyncSurface): string[] {
  return [...s.session.caps] as string[];
}

export function partitioned(s: SyncSurface): string[] {
  return s.session.network.partitions().map(([a, b]) => `${a}|${b}`);
}

export const createNote = sync.action({
  name: 'createNote',
  enabled: (s) => s.clients.length > 0,
  weight: 3,
  args: ['client:0', 'note'] as const,
  draw: (s) =>
    gen(
      fc.tuple(
        fc.constantFrom(...s.clients.map((c) => c.id)),
        fc.string({ maxLength: 20 })
      )
    ),
  act: (s, client: string, body: string) => {
    const c = s.clients.find((x) => x.id === client);
    if (c === undefined) return;
    createNoteOnClient({
      server: s.server,
      client: c,
      id: s.session.ports.createId(),
      body,
    });
  },
});

export const partition = sync.action({
  name: 'partition',
  enabled: (s) => caps(s).includes('partition') && s.clients.length > 0,
  weight: (s) => (partitioned(s).length === 0 ? 2 : 1),
  args: ['client:0'] as const,
  draw: (s) => gen(fc.constantFrom(...s.clients.map((c) => c.id))),
  act: (s, id: string) => {
    s.session.network.partition('server', id);
  },
});

export const heal = sync.action({
  name: 'heal',
  enabled: (s) => caps(s).includes('partition'),
  weight: 2,
  act: (s) => {
    s.session.network.healAll();
    rebroadcastNotes(s.server);
    for (const c of s.clients) flushPending(s.server, c);
  },
});

export const SYNC_ACTIONS = [createNote, partition, heal] as const;

export const converges = sync.property({
  name: 'converges',
  check: (s) => {
    if (quiet(s) && partitioned(s).length === 0 && !converged(s)) {
      throw new Error('quiet but diverged');
    }
  },
});

export const SYNC_PROPERTIES = [converges];

export const arbSyncArgs = (): fc.Arbitrary<SyncArgs> =>
  fc.record({ clients: fc.integer({ min: 1, max: 3 }) });

export type { SyncSurface };
