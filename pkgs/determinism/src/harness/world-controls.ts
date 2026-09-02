import type { Network, NodeId } from '../models/network';
import { applyCommands } from './apply-commands';
import type { CommandDef } from './command';
import type { ScenarioDef } from './define-scenario';
import type { World, WorldControls } from './world-types';

type StartedNode = {
  readonly id: string;
  readonly role: string;
  readonly endpointIds: readonly string[];
};

type ControlContext = {
  readonly ports: WorldControls['ports'];
  readonly network: Network;
  readonly started: readonly StartedNode[];
  readonly startTime: number;
  readonly networkFaults: WorldControls['networkFaults'];
  readonly dispose: () => Promise<void>;
};

function endpointsForNode(
  started: readonly StartedNode[],
  nodeId: NodeId
): readonly string[] {
  const n = started.find((b) => b.id === nodeId);
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

function nodeIdsFromStarted(
  started: readonly StartedNode[],
  role: string
): string[] {
  return started.filter((b) => b.role === role).map((b) => b.id);
}

function timingControls(
  ctx: ControlContext
): Pick<
  WorldControls,
  'now' | 'advance' | 'quiesce' | 'eventually' | 'never' | 'resolve'
> {
  const clock = ctx.ports.scheduler.clock;
  const scheduler = ctx.ports.scheduler;
  return {
    now: () => clock.now(),
    advance: async (ms) => {
      await scheduler.runFor(ms);
    },
    quiesce: async () => {
      await scheduler.runUntilQuiescent();
    },
    eventually: async (pred, opts) => {
      const withinMs = opts?.withinMs ?? 2_000;
      const start = clock.now();
      if (await pred()) return clock.now();
      const ok = await scheduler.runUntil(pred, { maxVirtualMs: withinMs });
      if (ok) return clock.now();
      const held = ctx.network.held();
      throw new Error(
        `eventually timed out seed=${ctx.ports.seed.toString(16)} now=${clock.now()} ` +
          `withinMs=${withinMs} pendingTasks=${scheduler.pendingTaskCount()} ` +
          `held=${held.length > 0 ? held.join(',') : 'none'} elapsed=${clock.now() - start}`
      );
    },
    never: async (pred, opts) => {
      const forMs = opts.forMs;
      const start = clock.now();
      const violated = (): Error =>
        new Error(
          `never violated seed=${ctx.ports.seed.toString(16)} now=${clock.now()} forMs=${forMs}`
        );
      if (await pred()) throw violated();
      const ok = await scheduler.runUntil(
        async () => {
          if (clock.now() - start >= forMs) return true;
          return !(await pred());
        },
        { maxVirtualMs: forMs + 1 }
      );
      if (!ok || (await pred())) throw violated();
    },
    resolve: async (promise) => {
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
      await scheduler.runUntil(async () => settled, {
        maxVirtualMs: 86_400_000,
      });
      if (error !== undefined) throw error;
      return result as Awaited<typeof promise>;
    },
  };
}

function networkControls(
  ctx: ControlContext
): Pick<
  WorldControls,
  'partition' | 'heal' | 'healAll' | 'hold' | 'release' | 'releaseAll'
> {
  const { network, started } = ctx;
  return {
    partition: (a, b) => {
      forEachEndpointPair(
        endpointsForNode(started, a),
        endpointsForNode(started, b),
        (x, y) => network.partition(x, y)
      );
      return {
        [Symbol.dispose]() {
          forEachEndpointPair(
            endpointsForNode(started, a),
            endpointsForNode(started, b),
            (x, y) => network.heal(x, y)
          );
        },
      };
    },
    heal: (a, b) => {
      forEachEndpointPair(
        endpointsForNode(started, a),
        endpointsForNode(started, b),
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
  K extends ScenarioDef['knobs'],
  N extends ScenarioDef['nodes'],
  X,
>(args: {
  readonly scenario: ScenarioDef<K, N, object, X>;
  readonly boundCommands: CommandDef[];
  readonly ctx: ControlContext;
  readonly worldRef: { current: World<K, N, X> | null };
}): WorldControls {
  const { scenario, boundCommands, ctx, worldRef } = args;
  const world = (): World<K, N, X> => worldRef.current as World<K, N, X>;
  const checkAlways = async (): Promise<void> => {
    await scenario.always(world());
  };

  return {
    seed: ctx.ports.seed,
    startTime: ctx.startTime,
    ports: ctx.ports,
    network: ctx.network,
    networkFaults: ctx.networkFaults,
    nodeIds: (role) => nodeIdsFromStarted(ctx.started, role),
    ...timingControls(ctx),
    ...networkControls(ctx),
    apply: async (commands) => {
      await applyCommands({
        advance: (ms) => ctx.ports.scheduler.runFor(ms),
        commands: commands as { readonly kind: string }[],
        apply: async (command) => {
          for (const def of boundCommands) {
            if (command.kind === def.kind) {
              await def.apply(world(), command as never);
              return;
            }
          }
          throw new Error(`World.apply: unknown command kind ${command.kind}`);
        },
        checkAlways,
      });
    },
    converge: async () => {
      await scenario.converge(world());
      await checkAlways();
    },
    dispose: ctx.dispose,
    [Symbol.asyncDispose]: ctx.dispose,
  };
}
