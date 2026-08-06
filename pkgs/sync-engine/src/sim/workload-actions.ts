import type { SeededRng } from './rng';
import { simSetNote } from './profile';
import type { SimWorld } from './world';

export type WorkloadAction =
  | {
      readonly kind: 'mutate';
      readonly clientId: string;
      readonly noteId: string;
      readonly body: string;
    }
  | { readonly kind: 'offline'; readonly clientId: string }
  | { readonly kind: 'online'; readonly clientId: string }
  | { readonly kind: 'background'; readonly clientId: string }
  | { readonly kind: 'foreground'; readonly clientId: string }
  | { readonly kind: 'partition'; readonly a: string; readonly b: string }
  | { readonly kind: 'heal' }
  | { readonly kind: 'idle'; readonly ms: number };

/** Pick one seeded workload action from a percentile roll. */
export function pickWorkloadAction(
  rng: SeededRng,
  clientIds: readonly string[]
): WorkloadAction {
  const roll = rng.int(100);
  const clientId = rng.pick(clientIds);
  if (roll < 55) {
    return {
      kind: 'mutate',
      clientId,
      noteId: `n${rng.int(4)}`,
      body: `b${rng.int(1000)}`,
    };
  }
  if (roll < 65) return { kind: 'idle', ms: 1 + rng.int(50) };
  if (roll < 75) return { kind: 'offline', clientId };
  if (roll < 85) return { kind: 'online', clientId };
  if (roll < 90) return { kind: 'background', clientId };
  if (roll < 95) return { kind: 'foreground', clientId };
  if (roll < 98 && clientIds.length >= 2) {
    const a = rng.pick(clientIds);
    const b = rng.pick(clientIds.filter((id) => id !== a));
    return { kind: 'partition', a, b };
  }
  return { kind: 'heal' };
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
  await client.mutate(simSetNote, {
    id: action.noteId,
    body: action.body,
  });
}

const ACTION_HANDLERS: {
  readonly [K in WorkloadAction['kind']]: ActionHandler<K>;
} = {
  mutate: handleMutate,
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
};

/** Dispatch one workload action via the handlers map. */
export async function dispatchWorkloadAction(
  world: SimWorld,
  action: WorkloadAction
): Promise<void> {
  switch (action.kind) {
    case 'mutate':
      return ACTION_HANDLERS.mutate(world, action);
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
    default: {
      const _exhaustive: never = action;
      void _exhaustive;
    }
  }
}
