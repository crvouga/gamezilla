import { assert } from '@pkgs/assert';

import type {
  ResourceCtx,
  ResourceImpl,
  ResourceRef,
  SystemDefinition,
} from '../system';
import type { ProviderSpec } from './providers';
import { createSeededRandom, createSimClock, hashSeed } from './rng';
import { createTrace, type Trace } from './trace';
import { makeFaults } from './world-faults';
import {
  attachWorldHandlers,
  type InstanceState,
  instanceAddress,
  mediateValue,
  type WorldInternal,
} from './world-runtime';

export type WorldTimers = {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
};

export type CreateWorldOptions = {
  seed: number | bigint | string;
  impls: readonly ResourceImpl<unknown, unknown>[];
  provide: Record<string, ProviderSpec>;
  startMs?: number;
  /** Wall or sim timers for resource Io (required for product DST). */
  timers: WorldTimers;
};

export type World = {
  spawn: <T = unknown>(name: string, instanceId?: string) => Promise<T>;
  faults: ReturnType<typeof makeFaults>;
  trace: Trace;
  traceString: () => string;
  dispose: () => void;
};

function createPending() {
  let pending = 0;
  const waiters: Array<() => void> = [];
  return {
    bump: () => {
      pending++;
    },
    done: () => {
      pending--;
      if (pending === 0) while (waiters.length > 0) waiters.pop()?.();
    },
    settle: async () => {
      if (pending === 0) return;
      await new Promise<void>((resolve) => waiters.push(resolve));
    },
  };
}

function seedToBigint(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') return seed;
  if (typeof seed === 'number') return BigInt(seed | 0);
  return BigInt(hashSeed(seed) >>> 0);
}

function createSeededCreateId(random: () => number): () => string {
  return () => {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i += 1) {
      bytes[i] = Math.floor(random() * 256);
    }
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  };
}

function makeBuildCtx(args: {
  readonly clock: { now(): number; advance(ms: number): void };
  readonly timers: WorldTimers;
  readonly random: () => number;
  readonly createId: () => string;
  readonly seed: bigint;
  readonly trace: Trace;
}): (address: string) => ResourceCtx {
  const { clock, timers, random, createId, seed, trace } = args;
  return (address) => ({
    address,
    log: (...logArgs) => {
      trace.push('log', address, logArgs.map(String).join(' '));
    },
    clock,
    timers,
    random,
    createId,
    seed,
  });
}

function makeEnsureInstance(
  instances: Map<string, InstanceState>
): (address: string, resource: ResourceRef) => InstanceState {
  return (address, resource) => {
    let inst = instances.get(address);
    if (!inst) {
      inst = { address, resource, live: null, down: false, evicted: false };
      instances.set(address, inst);
    }
    return inst;
  };
}

function makeWorldApi(args: {
  readonly system: SystemDefinition;
  readonly options: CreateWorldOptions;
  readonly worldRef: WorldInternal;
  readonly settle: () => Promise<void>;
  readonly instances: Map<string, InstanceState>;
  readonly sharedLive: Map<string, unknown>;
  readonly partitions: Set<string>;
  readonly trace: Trace;
  readonly ensureInstance: (
    address: string,
    resource: ResourceRef
  ) => InstanceState;
}): World {
  const {
    system,
    options,
    worldRef,
    settle,
    instances,
    sharedLive,
    partitions,
    trace,
    ensureInstance,
  } = args;
  return {
    async spawn<T = unknown>(name: string, instanceId?: string): Promise<T> {
      const resource = system.roots[name];
      assert.ok(!!resource, `unknown root '${name}'`);
      const address = instanceAddress(name, instanceId);
      const live = await worldRef.getOrBuild(resource, address, 'world');
      return wrapSpawnFacade(
        mediateValue(live, 'world', address, worldRef),
        settle
      ) as T;
    },
    faults: makeFaults({
      instances,
      sharedLive,
      partitions,
      trace,
      system,
      provide: options.provide,
      ensureInstance,
    }),
    trace,
    traceString: () => trace.toString(),
    dispose() {
      instances.clear();
      sharedLive.clear();
      partitions.clear();
    },
  };
}

export function createWorld(
  system: SystemDefinition,
  options: CreateWorldOptions
): World {
  const random = createSeededRandom(options.seed);
  const createId = createSeededCreateId(
    createSeededRandom(`${String(options.seed)}:ids`)
  );
  const seed = seedToBigint(options.seed);
  const clock = createSimClock(options.startMs ?? 0);
  const trace = createTrace();
  const partitions = new Set<string>();
  const instances = new Map<string, InstanceState>();
  const sharedLive = new Map<string, unknown>();
  const factoryByResource = new Map(
    options.impls.map((i) => [i.resource, i.factory])
  );
  const { bump, done, settle } = createPending();
  const worldRef: WorldInternal = {
    scheduleCall: async () => null,
    getOrBuild: async () => null,
  };
  const ensureInstance = makeEnsureInstance(instances);
  attachWorldHandlers({
    worldRef,
    system,
    options,
    instances,
    sharedLive,
    partitions,
    trace,
    factoryByResource,
    buildCtx: makeBuildCtx({
      clock,
      timers: options.timers,
      random,
      createId,
      seed,
      trace,
    }),
    ensureInstance,
    bump,
    done,
  });
  return makeWorldApi({
    system,
    options,
    worldRef,
    settle,
    instances,
    sharedLive,
    partitions,
    trace,
    ensureInstance,
  });
}

function wrapSpawnFacade(
  facade: unknown,
  settle: () => Promise<void>
): unknown {
  if (typeof facade === 'function') {
    return async (...args: unknown[]) => {
      const result = await (facade as (...a: unknown[]) => unknown)(...args);
      await settle();
      return result;
    };
  }
  if (facade !== null && typeof facade === 'object') {
    return new Proxy(facade as object, {
      get(target, prop, receiver) {
        const raw = Reflect.get(target, prop, receiver);
        if (typeof raw !== 'function') return raw;
        return async (...args: unknown[]) => {
          const result = await raw.apply(target, args);
          await settle();
          return result;
        };
      },
    });
  }
  return facade;
}
