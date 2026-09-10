/**
 * Expand live topology into crash / partition / clock palette commands.
 */

import type {
  ProductSimulatorPaletteCommand,
  ProductSimulatorSession,
} from '@pkgs/sim-console/client';

function collectIds(session: ProductSimulatorSession): string[] {
  const ids = ['server'];
  for (const c of session.clients.values()) ids.push(c.id);
  return ids;
}

export function buildProductSimulatorPaletteCommands(
  session: ProductSimulatorSession
): ProductSimulatorPaletteCommand[] {
  const ids = collectIds(session);
  const out: ProductSimulatorPaletteCommand[] = [];

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
    id: 'net:heal',
    title: 'session · heal',
    category: 'Network',
    keywords: ['heal', 'restoreNetwork', 'partition'],
    run: () => session.heal(),
  });

  for (const id of ids) {
    out.push({
      id: `crash:${id}`,
      title: `${id} · crash`,
      category: 'Crash',
      keywords: ['crash', id],
      run: () => session.crash(id),
    });
    out.push({
      id: `restart:${id}`,
      title: `${id} · restart`,
      category: 'Crash',
      keywords: ['restart', id],
      run: () => session.restart(id),
    });
  }

  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = ids[i]!;
      const b = ids[j]!;
      out.push({
        id: `partition:${a}:${b}`,
        title: `${a} ↛ ${b}`,
        category: 'Partition',
        keywords: ['partition', a, b],
        run: () => session.partition(a, b),
      });
    }
  }

  return out;
}

export async function buildSnapshotLoadCommands(
  session: ProductSimulatorSession
): Promise<ProductSimulatorPaletteCommand[]> {
  const snaps = await session.listSnapshots();
  return snaps
    .filter((s) => s.compatible)
    .map((s) => ({
      id: `snapshot:load:${s.id}`,
      title: `load · ${s.label}`,
      category: 'Snapshot',
      keywords: ['snapshot', 'load', s.label],
      run: () => session.loadSnapshot(s.id),
    }));
}
