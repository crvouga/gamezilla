/**
 * Expand live topology into actor × operation × subject palette commands.
 */

import type {
  PlaygroundPaletteCommand,
  PlaygroundSession,
} from '@pkgs/system-console/client';

const SKEW_PRESETS_MS = [0, 250, -250, 1000, -1000, 5000, -5000] as const;

const UNARY_OPS = [
  'crash',
  'restart',
  'evict',
  'corrupt',
  'wipe',
  'clear-skew',
] as const;

type UnaryOp = (typeof UNARY_OPS)[number];

function collectAddresses(session: PlaygroundSession): string[] {
  const addrs = [session.server.address, session.pubsub.address];
  for (const c of session.clients.values()) addrs.push(c.address);
  for (const r of session.rooms.values()) addrs.push(r.address);
  return addrs;
}

function runUnary(
  session: PlaygroundSession,
  op: UnaryOp,
  address: string
): void | Promise<void> {
  const { faults } = session.world;
  switch (op) {
    case 'crash':
      faults.crash(address);
      return;
    case 'restart':
      faults.restart(address);
      return;
    case 'evict':
      faults.evict(address);
      return;
    case 'corrupt':
      return Promise.all([
        faults.corrupt(`${address}.db`).catch(() => faults.corrupt(address)),
      ]).then(() => undefined);
    case 'wipe':
      return Promise.all([
        faults.wipe(`${address}.db`).catch(() => faults.wipe(address)),
      ]).then(() => undefined);
    case 'clear-skew':
      faults.clearSkew(address);
      return;
  }
}

/**
 * Build searchable fault / clock / snapshot palette entries for the live session.
 */
export function buildPlaygroundPaletteCommands(
  session: PlaygroundSession
): PlaygroundPaletteCommand[] {
  const addresses = collectAddresses(session);
  const out: PlaygroundPaletteCommand[] = [];

  out.push({
    id: 'clock:pause',
    title: 'session · pause-clock',
    category: 'Clock',
    keywords: ['pause', 'clock'],
    run: () => session.setClockPaused(true),
  });
  out.push({
    id: 'clock:resume',
    title: 'session · resume-clock',
    category: 'Clock',
    keywords: ['resume', 'clock'],
    run: () => session.setClockPaused(false),
  });
  out.push({
    id: 'fault:heal-all',
    title: '* · heal-all',
    category: 'Fault',
    keywords: ['heal', 'partition'],
    run: () => session.world.faults.heal(),
  });

  for (const address of addresses) {
    for (const op of UNARY_OPS) {
      out.push({
        id: `fault:${op}:${address}`,
        title: `${address} · ${op}`,
        category: 'Fault',
        keywords: [address, op],
        run: () => runUnary(session, op, address),
      });
    }
    for (const ms of SKEW_PRESETS_MS) {
      out.push({
        id: `fault:skew:${address}:${String(ms)}`,
        title: `${address} · skew · ${String(ms)}ms`,
        category: 'Fault',
        keywords: [address, 'skew', String(ms)],
        run: () => session.world.faults.skewClock(address, ms),
      });
    }
  }

  for (let i = 0; i < addresses.length; i += 1) {
    for (let j = i + 1; j < addresses.length; j += 1) {
      const a = addresses[i]!;
      const b = addresses[j]!;
      out.push({
        id: `fault:partition:${a}:${b}`,
        title: `${a} · partition · ${b}`,
        category: 'Fault',
        keywords: [a, b, 'partition'],
        run: () => session.world.faults.partition(a, b),
      });
      out.push({
        id: `fault:heal:${a}:${b}`,
        title: `${a} · heal · ${b}`,
        category: 'Fault',
        keywords: [a, b, 'heal'],
        run: () => session.world.faults.heal(a, b),
      });
    }
  }

  out.push({
    id: 'snapshot:save',
    title: 'snapshot · save',
    category: 'Snapshot',
    keywords: ['snapshot', 'save', 'minio'],
    run: async () => {
      await session.saveSnapshot();
    },
  });

  return out;
}

/** Async-expand load commands from the snapshot index. */
export async function buildSnapshotLoadCommands(
  session: PlaygroundSession
): Promise<PlaygroundPaletteCommand[]> {
  const list = await session.listSnapshots();
  return list.flatMap((snap) => [
    {
      id: `snapshot:load:${snap.id}`,
      title: `snapshot · load · ${snap.label}`,
      subtitle: snap.id,
      category: 'Snapshot',
      keywords: ['snapshot', 'load', snap.id, snap.label],
      run: async () => {
        await session.loadSnapshot(snap.id);
      },
    },
    {
      id: `snapshot:delete:${snap.id}`,
      title: `snapshot · delete · ${snap.label}`,
      subtitle: snap.id,
      category: 'Snapshot',
      keywords: ['snapshot', 'delete', 'remove', snap.id, snap.label],
      run: async () => {
        await session.deleteSnapshot(snap.id);
      },
    },
  ]);
}
