import type { SimFaultOptions } from '../../sim/faults';
import type { SeededRng } from '../../sim/rng';
import type { SimTraffic } from '../../sim/traffic';
import type { SimWorld } from '../../sim/world';
import { setFolder, setNote } from './shared/mutations';

const SERVER_NODE = 'server';

const SKEW_MS = [-60_000, -1_000, 0, 1_000, 60_000] as const;
const LIVE_ONLY: readonly SimTraffic[] = ['live'];
const HOLD_TRAFFIC: readonly SimTraffic[] = ['live', 'sync', 'all'];

export type WorkloadAction =
  | {
      readonly kind: 'mutate';
      readonly clientId: string;
      readonly noteId: string;
      readonly body: string;
    }
  | {
      readonly kind: 'mutateFolder';
      readonly clientId: string;
      readonly folderId: string;
      readonly title: string;
    }
  | { readonly kind: 'offline'; readonly clientId: string }
  | { readonly kind: 'online'; readonly clientId: string }
  | { readonly kind: 'background'; readonly clientId: string }
  | { readonly kind: 'foreground'; readonly clientId: string }
  | {
      readonly kind: 'partition';
      readonly nodeId: string;
      readonly traffic: SimTraffic;
    }
  | { readonly kind: 'heal' }
  | { readonly kind: 'idle'; readonly ms: number }
  | {
      readonly kind: 'skew';
      readonly nodeId: string;
      readonly skewMs: number;
    }
  | { readonly kind: 'crash'; readonly clientId: string }
  | { readonly kind: 'restart'; readonly clientId: string }
  | {
      readonly kind: 'hold';
      readonly nodeId: string;
      readonly traffic: SimTraffic;
    }
  | {
      readonly kind: 'release';
      readonly nodeId: string;
      readonly traffic: SimTraffic;
    }
  | {
      readonly kind: 'setFaults';
      readonly nodeId: string;
      readonly traffic: 'live';
      readonly faults: Partial<SimFaultOptions>;
    };

function sampleLiveFaults(rng: SeededRng): Partial<SimFaultOptions> {
  return {
    packetLossProbability: rng.int(41) / 100,
    packetReplayProbability: rng.int(31) / 100,
    reorderWindow: rng.int(6),
    oneWayDelayMeanMs: rng.int(40),
    oneWayDelayJitterMs: rng.int(30),
  };
}

/** Pick one seeded workload action from a percentile roll. */
export function pickWorkloadAction(
  rng: SeededRng,
  clientIds: readonly string[]
): WorkloadAction {
  const roll = rng.int(100);
  const clientId = rng.pick(clientIds);
  if (roll < 38) {
    return {
      kind: 'mutate',
      clientId,
      noteId: `n${rng.int(4)}`,
      body: `b${rng.int(1000)}`,
    };
  }
  if (roll < 46) {
    return {
      kind: 'mutateFolder',
      clientId,
      folderId: `f${rng.int(3)}`,
      title: `t${rng.int(100)}`,
    };
  }
  if (roll < 54) return { kind: 'idle', ms: 1 + rng.int(50) };
  if (roll < 60) return { kind: 'offline', clientId };
  if (roll < 66) return { kind: 'online', clientId };
  if (roll < 70) return { kind: 'background', clientId };
  if (roll < 74) return { kind: 'foreground', clientId };
  if (roll < 78) {
    return {
      kind: 'partition',
      nodeId: clientId,
      traffic: rng.pick(LIVE_ONLY),
    };
  }
  if (roll < 82) return { kind: 'heal' };
  if (roll < 85) {
    return {
      kind: 'hold',
      nodeId: clientId,
      traffic: rng.pick(HOLD_TRAFFIC),
    };
  }
  if (roll < 90) {
    return {
      kind: 'release',
      nodeId: clientId,
      traffic: rng.pick(HOLD_TRAFFIC),
    };
  }
  if (roll < 93) {
    return {
      kind: 'setFaults',
      nodeId: clientId,
      traffic: 'live',
      faults: sampleLiveFaults(rng),
    };
  }
  if (roll < 96) {
    const nodeId = rng.int(5) === 0 ? SERVER_NODE : rng.pick(clientIds);
    return {
      kind: 'skew',
      nodeId,
      skewMs: rng.pick([...SKEW_MS]),
    };
  }
  if (roll < 98) return { kind: 'crash', clientId };
  return { kind: 'restart', clientId };
}

type ActionHandler<K extends WorkloadAction['kind']> = (
  world: SimWorld,
  action: Extract<WorkloadAction, { kind: K }>
) => Promise<void>;

async function handleMutate(
  world: SimWorld,
  action: Extract<WorkloadAction, { kind: 'mutate' }>
): Promise<void> {
  const client = world.clients.get(action.clientId);
  if (client === undefined) return;
  await client.mutate(setNote, {
    id: action.noteId,
    body: action.body,
    title: '',
  });
}

async function handleMutateFolder(
  world: SimWorld,
  action: Extract<WorkloadAction, { kind: 'mutateFolder' }>
): Promise<void> {
  const client = world.clients.get(action.clientId);
  if (client === undefined) return;
  await client.mutate(setFolder, {
    id: action.folderId,
    title: action.title,
  });
}

const ACTION_HANDLERS: {
  readonly [K in WorkloadAction['kind']]: ActionHandler<K>;
} = {
  mutate: handleMutate,
  mutateFolder: handleMutateFolder,
  offline: async (world, action) => {
    world.clients.get(action.clientId)?.online(false);
  },
  online: async (world, action) => {
    world.clients.get(action.clientId)?.online(true);
  },
  background: async (world, action) => {
    world.clients.get(action.clientId)?.foreground(false);
  },
  foreground: async (world, action) => {
    world.clients.get(action.clientId)?.foreground(true);
  },
  partition: async (world, action) => {
    world.net(action.nodeId, action.traffic).set('down');
  },
  heal: async (world) => {
    for (const id of world.clients.keys()) {
      world.net(id, 'all').set('ok');
    }
  },
  idle: async (world, action) => {
    await world.runFor(action.ms);
  },
  skew: async (world, action) => {
    world.node(action.nodeId).skewClock(action.skewMs);
  },
  crash: async (world, action) => {
    if (!world.clients.has(action.clientId)) return;
    await world.node(action.clientId).crash();
  },
  restart: async (world, action) => {
    try {
      await world.node(action.clientId).restart();
    } catch {
      // No meta yet (should not happen for boot clients).
    }
  },
  hold: async (world, action) => {
    world.net(action.nodeId, action.traffic).set('hold');
  },
  release: async (world, action) => {
    world.net(action.nodeId, action.traffic).set('ok');
  },
  setFaults: async (world, action) => {
    world.net(action.nodeId, action.traffic).set(action.faults);
  },
};

/** Dispatch one workload action via the handlers map. */
export async function dispatchWorkloadAction(
  world: SimWorld,
  action: WorkloadAction
): Promise<void> {
  switch (action.kind) {
    case 'mutate':
      return ACTION_HANDLERS.mutate(world, action);
    case 'mutateFolder':
      return ACTION_HANDLERS.mutateFolder(world, action);
    case 'offline':
      return ACTION_HANDLERS.offline(world, action);
    case 'online':
      return ACTION_HANDLERS.online(world, action);
    case 'background':
      return ACTION_HANDLERS.background(world, action);
    case 'foreground':
      return ACTION_HANDLERS.foreground(world, action);
    case 'partition':
      return ACTION_HANDLERS.partition(world, action);
    case 'heal':
      return ACTION_HANDLERS.heal(world, action);
    case 'idle':
      return ACTION_HANDLERS.idle(world, action);
    case 'skew':
      return ACTION_HANDLERS.skew(world, action);
    case 'crash':
      return ACTION_HANDLERS.crash(world, action);
    case 'restart':
      return ACTION_HANDLERS.restart(world, action);
    case 'hold':
      return ACTION_HANDLERS.hold(world, action);
    case 'release':
      return ACTION_HANDLERS.release(world, action);
    case 'setFaults':
      return ACTION_HANDLERS.setFaults(world, action);
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }
}
