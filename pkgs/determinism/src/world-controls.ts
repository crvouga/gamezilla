import type { ActionDef } from './action';
import type { SystemDef } from './define-system';
import type { SimNetwork, SimNodeId } from './network';
import { playActions } from './play';
import type { World, WorldControls } from './world-types';

type BootedNode = {
  readonly id: string;
  readonly role: string;
  readonly endpointIds: readonly string[];
};

type ControlCtx = {
  readonly deps: WorldControls['deps'];
  readonly network: SimNetwork;
  readonly booted: readonly BootedNode[];
  readonly startMs: number;
  readonly networkDefaults: WorldControls['networkDefaults'];
  readonly dispose: () => Promise<void>;
};

function endpointsForNode(
  booted: readonly BootedNode[],
  nodeId: SimNodeId
): readonly string[] {
  const n = booted.find((b) => b.id === nodeId);
  if (n === undefined) throw new Error(`World: unknown node id ${nodeId}`);
  return n.endpointIds;
}

function forEachEndpointPair(
  aEps: readonly string[],
  bEps: readonly string[],
  fn: (a: string, b: string) => void
): void {
  for (const a of aEps) {
    for (const b of bEps) {
      if (a === b) continue;
      fn(a, b);
    }
  }
}

function roleIdsFromBooted(
  booted: readonly BootedNode[],
  role: string
): string[] {
  return booted.filter((b) => b.role === role).map((b) => b.id);
}

function timingControls(
  ctx: ControlCtx
): Pick<WorldControls, 'now' | 'advance' | 'idle' | 'until' | 'never' | 'run'> {
  const simClock = ctx.deps.scheduler.clock;
  return {
    now: () => simClock.now(),
    advance: async (ms) => {
      await ctx.deps.scheduler.runFor(ms);
    },
    idle: async () => {
      await ctx.deps.scheduler.runUntilIdle();
    },
    until: async (pred, opts) => {
      const withinMs = opts?.withinMs ?? 2_000;
      const start = simClock.now();
      if (await pred()) return simClock.now();
      const ok = await ctx.deps.scheduler.runUntil(pred, {
        maxVirtualMs: withinMs,
      });
      if (ok) return simClock.now();
      const held = ctx.network.held();
      throw new Error(
        `until timed out seed=${ctx.deps.seed.toString(16)} now=${simClock.now()} ` +
          `withinMs=${withinMs} pendingEvents=${ctx.deps.scheduler.pendingCount()} ` +
          `held=${held.length > 0 ? held.join(',') : 'none'} elapsed=${simClock.now() - start}`
      );
    },
    never: async (pred, opts) => {
      const forMs = opts.forMs;
      const start = simClock.now();
      if (await pred()) {
        throw new Error(
          `never violated seed=${ctx.deps.seed.toString(16)} now=${simClock.now()} forMs=${forMs}`
        );
      }
      const ok = await ctx.deps.scheduler.runUntil(
        async () => {
          if (simClock.now() - start >= forMs) return true;
          return !(await pred());
        },
        { maxVirtualMs: forMs + 1 }
      );
      if (!ok || (await pred())) {
        throw new Error(
          `never violated seed=${ctx.deps.seed.toString(16)} now=${simClock.now()} forMs=${forMs}`
        );
      }
    },
    run: async (promise) => {
      let settled = false;
      let result!: unknown;
      let error: unknown;
      void promise.then(
        (v) => {
          settled = true;
          result = v;
        },
        (e) => {
          settled = true;
          error = e;
        }
      );
      await ctx.deps.scheduler.runUntil(async () => settled, {
        maxVirtualMs: 86_400_000,
      });
      if (error !== undefined) throw error;
      return result as Awaited<typeof promise>;
    },
  };
}

function networkControls(
  ctx: ControlCtx
): Pick<
  WorldControls,
  'partition' | 'heal' | 'healAll' | 'hold' | 'release' | 'releaseAll'
> {
  const { network, booted } = ctx;
  return {
    partition: (a, b) => {
      forEachEndpointPair(
        endpointsForNode(booted, a),
        endpointsForNode(booted, b),
        (x, y) => network.partition(x, y)
      );
      return {
        [Symbol.dispose]() {
          forEachEndpointPair(
            endpointsForNode(booted, a),
            endpointsForNode(booted, b),
            (x, y) => network.heal(x, y)
          );
        },
      };
    },
    heal: (a, b) => {
      forEachEndpointPair(
        endpointsForNode(booted, a),
        endpointsForNode(booted, b),
        (x, y) => network.heal(x, y)
      );
    },
    healAll: () => network.healAll(),
    hold: (key) => {
      network.hold(key);
      return {
        [Symbol.dispose]() {
          network.release(key);
        },
      };
    },
    release: (key) => network.release(key),
    releaseAll: () => network.releaseAll(),
  };
}

export function buildWorldControls<
  K extends SystemDef['knobs'],
  N extends SystemDef['nodes'],
  X,
>(args: {
  readonly system: SystemDef<K, N, object, X>;
  readonly boundActions: ActionDef[];
  readonly ctx: ControlCtx;
  readonly worldRef: { current: World<K, N, X> | null };
}): WorldControls {
  const { system, boundActions, ctx, worldRef } = args;
  const runInvariants = async (): Promise<void> => {
    await system.invariants(worldRef.current as World<K, N, X>);
  };

  return {
    seed: ctx.deps.seed,
    startMs: ctx.startMs,
    deps: ctx.deps,
    network: ctx.network,
    networkDefaults: ctx.networkDefaults,
    ids: (role) => roleIdsFromBooted(ctx.booted, role),
    ...timingControls(ctx),
    ...networkControls(ctx),
    play: async (actions) => {
      await playActions({
        advance: (ms) => ctx.deps.scheduler.runFor(ms),
        actions: actions as { readonly kind: string }[],
        dispatch: async (action) => {
          for (const def of boundActions) {
            if (action.kind === def.kind) {
              await def.dispatch(
                worldRef.current as World<K, N, X>,
                action as never
              );
              return;
            }
          }
          throw new Error(`dispatch: unknown action kind ${action.kind}`);
        },
        runInvariants,
      });
    },
    settle: async () => {
      await system.settle(worldRef.current as World<K, N, X>);
      await runInvariants();
    },
    dispose: ctx.dispose,
    [Symbol.asyncDispose]: ctx.dispose,
  };
}
