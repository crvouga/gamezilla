import { assert } from '@pkgs/assert';

import type {
  ResourceCtx,
  ResourceImpl,
  ResourceRef,
  SystemDefinition,
} from '../system';
import type { ProviderSpec } from './providers';
import { createSeededRandom, createSimClock } from './rng';
import { createTrace, type Trace } from './trace';
import { makeFaults } from './world-faults';
import {
  attachWorldHandlers,
  type InstanceState,
  instanceAddress,
  mediateValue,
  type WorldInternal,
} from './world-runtime';

export type CreateWorldOptions = {
  seed: number | bigint | string;
  impls: readonly ResourceImpl<unknown, unknown>[];
  provide: Record<string, ProviderSpec>;
  startMs?: number;
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

export function createWorld(
  system: SystemDefinition,
  options: CreateWorldOptions
): World {
  const random = createSeededRandom(options.seed);
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
  const buildCtx = (address: string): ResourceCtx => ({
    address,
    log: (...args) => {
      trace.push('log', address, args.map(String).join(' '));
    },
    clock,
    random,
  });
  const ensureInstance = (
    address: string,
    resource: ResourceRef
  ): InstanceState => {
    let inst = instances.get(address);
    if (!inst) {
      inst = { address, resource, live: null, down: false, evicted: false };
      instances.set(address, inst);
    }
    return inst;
  };
  attachWorldHandlers({
    worldRef,
    system,
    options,
    instances,
    sharedLive,
    partitions,
    trace,
    factoryByResource,
    buildCtx,
    ensureInstance,
    bump,
    done,
  });
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
