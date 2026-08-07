import { SIM_SERVER_NODE_ID } from './clock-skew';
import { setFolder, setNote } from './notes-app';
import type { SeededRng } from './rng';
import type { SimWorld } from './world';

const SKEW_MS = [-60_000, -1_000, 0, 1_000, 60_000] as const;

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
  | { readonly kind: 'partition'; readonly a: string; readonly b: string }
  | { readonly kind: 'heal' }
  | { readonly kind: 'idle'; readonly ms: number }
  | {
      readonly kind: 'skew';
      readonly nodeId: string;
      readonly skewMs: number;
    }
  | { readonly kind: 'crash'; readonly clientId: string }
  | { readonly kind: 'restart'; readonly clientId: string };

/** Pick one seeded workload action from a percentile roll. */
export function pickWorkloadAction(
  rng: SeededRng,
  clientIds: readonly string[]
): WorkloadAction {
  const roll = rng.int(100);
  const clientId = rng.pick(clientIds);
  if (roll < 40) {
    return {
      kind: 'mutate',
      clientId,
      noteId: `n${rng.int(4)}`,
      body: `b${rng.int(1000)}`,
    };
  }
  if (roll < 48) {
    return {
      kind: 'mutateFolder',
      clientId,
      folderId: `f${rng.int(3)}`,
      title: `t${rng.int(100)}`,
    };
  }
  if (roll < 56) return { kind: 'idle', ms: 1 + rng.int(50) };
  if (roll < 64) return { kind: 'offline', clientId };
  if (roll < 72) return { kind: 'online', clientId };
  if (roll < 76) return { kind: 'background', clientId };
  if (roll < 80) return { kind: 'foreground', clientId };
  if (roll < 84 && clientIds.length >= 2) {
    const a = rng.pick(clientIds);
    const b = rng.pick(clientIds.filter((id) => id !== a));
    return { kind: 'partition', a, b };
  }
  if (roll < 88) return { kind: 'heal' };
  if (roll < 94) {
    const nodeId = rng.int(5) === 0 ? SIM_SERVER_NODE_ID : rng.pick(clientIds);
    return {
      kind: 'skew',
      nodeId,
      skewMs: rng.pick([...SKEW_MS]),
    };
  }
  if (roll < 97) return { kind: 'crash', clientId };
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
    world.clients.get(action.clientId)?.lifecycle.setOnline(false);
  },
  online: async (world, action) => {
    world.clients.get(action.clientId)?.lifecycle.setOnline(true);
  },
  background: async (world, action) => {
    world.clients.get(action.clientId)?.lifecycle.setForeground(false);
  },
  foreground: async (world, action) => {
    world.clients.get(action.clientId)?.lifecycle.setForeground(true);
  },
  partition: async (world, action) => {
    world.partition(action.a, action.b);
  },
  heal: async (world) => {
    world.healAll();
  },
  idle: async (world, action) => {
    await world.runFor(action.ms);
  },
  skew: async (world, action) => {
    world.setClockSkew(action.nodeId, action.skewMs);
  },
  crash: async (world, action) => {
    if (!world.clients.has(action.clientId)) return;
    await world.crashClient(action.clientId);
  },
  restart: async (world, action) => {
    try {
      await world.restartClient(action.clientId);
    } catch {
      // No meta yet (should not happen for boot clients).
    }
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
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }
}
