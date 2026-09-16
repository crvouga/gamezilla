/**
 * Expand live topology into topology / crash / partition / clock palette
 * commands. Every node the session knows about — clients, the balancer, and
 * each API instance — gets its own fault entries.
 */

import type {
  ProductSimulatorPaletteCommand,
  ProductSimulatorSession,
} from '@pkgs/sim-console/client';

function collectIds(session: ProductSimulatorSession): string[] {
  const ids = [session.loadBalancer.id, ...session.servers.keys()];
  for (const c of session.clients.values()) ids.push(c.id);
  return ids;
}

function clockCommands(
  session: ProductSimulatorSession
): ProductSimulatorPaletteCommand[] {
  return [
    {
      id: 'clock:pause',
      title: 'session · pause-clock',
      category: 'Clock',
      keywords: ['pause', 'clock'],
      run: () => session.setClockPaused(true),
    },
    {
      id: 'clock:resume',
      title: 'session · resume-clock',
      category: 'Clock',
      keywords: ['resume', 'clock'],
      run: () => session.setClockPaused(false),
    },
    {
      id: 'net:heal',
      title: 'session · heal',
      category: 'Network',
      keywords: ['heal', 'restoreNetwork', 'partition'],
      run: () => session.heal(),
    },
  ];
}

function topologyCommands(
  session: ProductSimulatorSession
): ProductSimulatorPaletteCommand[] {
  const out: ProductSimulatorPaletteCommand[] = [
    {
      id: 'topology:add-client',
      title: 'topology · add client',
      category: 'Topology',
      keywords: ['add', 'client', 'spawn', 'node'],
      run: () => session.addClient(),
    },
    {
      id: 'topology:add-server',
      title: 'topology · add server',
      subtitle: 'Another API instance in the round-robin rotation',
      category: 'Topology',
      keywords: ['add', 'server', 'instance', 'scale', 'node'],
      run: () => session.addServer(),
    },
  ];
  for (const id of session.clients.keys()) {
    out.push({
      id: `topology:remove-client:${id}`,
      title: `${id} · remove client`,
      category: 'Topology',
      keywords: ['remove', 'client', id],
      run: () => session.removeClient(id),
    });
  }
  if (session.servers.size > 1) {
    for (const id of session.servers.keys()) {
      out.push({
        id: `topology:remove-server:${id}`,
        title: `${id} · remove server`,
        category: 'Topology',
        keywords: ['remove', 'server', 'instance', id],
        run: () => session.removeServer(id),
      });
    }
  }
  return out;
}

function faultCommands(
  session: ProductSimulatorSession,
  ids: readonly string[]
): ProductSimulatorPaletteCommand[] {
  const out: ProductSimulatorPaletteCommand[] = [];
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

export function buildProductSimulatorPaletteCommands(
  session: ProductSimulatorSession
): ProductSimulatorPaletteCommand[] {
  return [
    ...clockCommands(session),
    ...topologyCommands(session),
    ...faultCommands(session, collectIds(session)),
  ];
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
