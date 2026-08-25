import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';

import type { WorkloadAction } from '../../domain-packs/notes-app/workload-actions';

export type WorkloadModel = {
  readonly clientIds: string[];
  online: Set<string>;
  partitioned: Set<string>;
  held: Set<string>;
  crashed: Set<string>;
  mutations: number;
};

export type WorkloadReal = {
  readonly actions: WorkloadAction[];
};

type WorkloadCmd = AsyncCommand<WorkloadModel, WorkloadReal>;

const clientArb = fc.constantFrom('c0', 'c1', 'c2');

function mutateCmd(
  clientId: string,
  noteId: string,
  body: string
): WorkloadCmd {
  return {
    check: (m) => m.online.has(clientId) && !m.crashed.has(clientId),
    run: async (m, r) => {
      m.mutations += 1;
      r.actions.push({ kind: 'mutate', clientId, noteId, body });
    },
    toString: () => `mutate(${clientId},${noteId})`,
  };
}

function offlineCmd(clientId: string): WorkloadCmd {
  return {
    check: (m) => m.online.has(clientId) && !m.crashed.has(clientId),
    run: async (m, r) => {
      m.online.delete(clientId);
      r.actions.push({ kind: 'offline', clientId });
    },
    toString: () => `offline(${clientId})`,
  };
}

function onlineCmd(clientId: string): WorkloadCmd {
  return {
    check: (m) => !m.online.has(clientId) && !m.crashed.has(clientId),
    run: async (m, r) => {
      m.online.add(clientId);
      r.actions.push({ kind: 'online', clientId });
    },
    toString: () => `online(${clientId})`,
  };
}

function partitionCmd(nodeId: string): WorkloadCmd {
  return {
    check: (m) => !m.partitioned.has(nodeId),
    run: async (m, r) => {
      m.partitioned.add(nodeId);
      r.actions.push({ kind: 'partition', nodeId, traffic: 'live' });
    },
    toString: () => `partition(${nodeId})`,
  };
}

function healCmd(): WorkloadCmd {
  return {
    check: (m) => m.partitioned.size > 0 || m.held.size > 0,
    run: async (m, r) => {
      m.partitioned.clear();
      m.held.clear();
      r.actions.push({ kind: 'heal' });
    },
    toString: () => 'heal',
  };
}

function idleCmd(ms: number): WorkloadCmd {
  return {
    check: () => true,
    run: async (_m, r) => {
      r.actions.push({ kind: 'idle', ms });
    },
    toString: () => `idle(${ms})`,
  };
}

export const workloadCommands = (
  maxCommands = 12
): fc.Arbitrary<Iterable<WorkloadCmd>> =>
  fc.commands(
    [
      fc
        .tuple(
          clientArb,
          fc.constantFrom('n0', 'n1', 'n2'),
          fc.string({ maxLength: 8 })
        )
        .map(([c, n, b]) => mutateCmd(c, n, b)),
      clientArb.map((c) => offlineCmd(c)),
      clientArb.map((c) => onlineCmd(c)),
      clientArb.map((c) => partitionCmd(c)),
      fc.constant(healCmd()),
      fc.integer({ min: 1, max: 50 }).map((ms) => idleCmd(ms)),
    ],
    { maxCommands, size: 'small' }
  );

export function initialWorkloadModel(): WorkloadModel {
  const clientIds = ['c0', 'c1', 'c2'];
  return {
    clientIds,
    online: new Set(clientIds),
    partitioned: new Set(),
    held: new Set(),
    crashed: new Set(),
    mutations: 0,
  };
}
