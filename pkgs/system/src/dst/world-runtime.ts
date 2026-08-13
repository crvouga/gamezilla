import { assert } from '@pkgs/assert';

import {
  getResourceDeps,
  getResourceFactory,
  isResourceKeyed,
  type ResourceCtx,
  type ResourceRef,
  type SystemDefinition,
} from '../system';
import type { ProviderSpec } from './providers';
import type { Trace } from './trace';

export type InstanceState = {
  address: string;
  resource: ResourceRef;
  live: unknown | null;
  down: boolean;
  evicted: boolean;
};

export type WorldInternal = {
  scheduleCall(
    from: string,
    to: string,
    method: string,
    run: () => unknown | Promise<unknown>
  ): Promise<unknown>;
  getOrBuild(
    resource: ResourceRef,
    address: string,
    caller: string
  ): Promise<unknown>;
};

export function instanceAddress(rootName: string, instanceId?: string): string {
  return instanceId === undefined ? rootName : `${rootName}:${instanceId}`;
}

/** Root instance addresses have no `.` (owned leaves use `owner.leaf`). */
export function isRootInstanceAddress(address: string): boolean {
  return !address.includes('.');
}

export function stateAddress(ownerAddress: string, leafKey: string): string {
  return `${ownerAddress}.${leafKey}`;
}

export function partitionKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function rootsOf(addr: string): string {
  return addr.split('.')[0] ?? addr;
}

export function isPartitioned(
  partitions: ReadonlySet<string>,
  a: string,
  b: string
): boolean {
  return (
    partitions.has(partitionKey(a, b)) ||
    partitions.has(partitionKey(rootsOf(a), rootsOf(b)))
  );
}

export function mediateValue(
  value: unknown,
  from: string,
  to: string,
  world: WorldInternal
): unknown {
  if (typeof value === 'function') {
    return (...args: unknown[]) =>
      world.scheduleCall(from, to, '()', async () =>
        (value as (...a: unknown[]) => unknown)(...args)
      );
  }
  if (value !== null && typeof value === 'object') {
    return new Proxy(value as object, {
      get(target, prop, receiver) {
        if (typeof prop === 'symbol') {
          return Reflect.get(target, prop, receiver);
        }
        const raw = Reflect.get(target, prop, receiver);
        if (typeof raw !== 'function') return raw;
        return (...args: unknown[]) =>
          world.scheduleCall(from, to, String(prop), async () =>
            raw.apply(target, args)
          );
      },
    });
  }
  return value;
}

export function findProvider(
  provide: Record<string, ProviderSpec>,
  address: string
): ProviderSpec | undefined {
  if (provide[address]) return provide[address];
  const noInstance = address.replace(/:[^.]*/, '');
  if (provide[noInstance]) return provide[noInstance];
  const base = address.split(':')[0] ?? address;
  if (provide[base]) return provide[base];
  for (const [key, spec] of Object.entries(provide)) {
    if (!key.includes('*')) continue;
    const re = new RegExp(
      `^${key.replace(/\./g, '\\.').replace(/\*/g, '[^./]+')}$`
    );
    if (re.test(address) || re.test(noInstance)) return spec;
  }
  return undefined;
}

export function keyedLookup(
  child: ResourceRef,
  addr: string,
  caller: string,
  worldRef: WorldInternal
): unknown {
  const target = async (...args: unknown[]) => {
    const live = await worldRef.getOrBuild(child, addr, caller);
    const mediated = mediateValue(live, caller, addr, worldRef);
    return (mediated as (...a: unknown[]) => unknown)(...args);
  };
  return new Proxy(target, {
    get(_t, prop, receiver) {
      if (prop === 'then') return undefined;
      if (
        prop === 'apply' ||
        prop === 'call' ||
        prop === 'bind' ||
        prop === 'length' ||
        prop === 'name'
      ) {
        return Reflect.get(target, prop, receiver);
      }
      return async (...args: unknown[]) => {
        const live = await worldRef.getOrBuild(child, addr, caller);
        const mediated = mediateValue(live, caller, addr, worldRef);
        const method = Reflect.get(mediated as object, prop);
        assert.ok(typeof method === 'function', `missing ${String(prop)}`);
        return method.apply(mediated, args);
      };
    },
  });
}

export async function resolveDeps(args: {
  resource: ResourceRef;
  ownerAddress: string;
  caller: string;
  system: SystemDefinition;
  worldRef: WorldInternal;
}): Promise<Record<string, unknown>> {
  const { resource, ownerAddress, caller, system, worldRef } = args;
  const deps = getResourceDeps(resource);
  if (!deps) return {};
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(deps)) {
    const rootAddr = system.addressOf(child);
    assert.ok(!!rootAddr, `unresolved dependency '${key}'`);
    if (isResourceKeyed(child)) {
      out[key] = (instanceKey: string) =>
        keyedLookup(
          child,
          instanceAddress(rootAddr, instanceKey),
          caller,
          worldRef
        );
      continue;
    }
    const namedRoot = system.roots[rootAddr] === child;
    const childAddress = namedRoot ? rootAddr : stateAddress(ownerAddress, key);
    const live = await worldRef.getOrBuild(child, childAddress, caller);
    out[key] = mediateValue(live, caller, childAddress, worldRef);
  }
  return out;
}

export function attachWorldHandlers(args: {
  worldRef: WorldInternal;
  system: SystemDefinition;
  options: { provide: Record<string, ProviderSpec> };
  instances: Map<string, InstanceState>;
  sharedLive: Map<string, unknown>;
  partitions: Set<string>;
  trace: Trace;
  factoryByResource: Map<ResourceRef, ReturnType<typeof getResourceFactory>>;
  buildCtx: (address: string) => ResourceCtx;
  ensureInstance: (address: string, resource: ResourceRef) => InstanceState;
  bump: () => void;
  done: () => void;
}): void {
  const {
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
  } = args;

  worldRef.getOrBuild = async (resource, address, caller) => {
    const inst = ensureInstance(address, resource);
    if (inst.down) throw new TypeError(`network error: ${address} is down`);
    if (inst.evicted) {
      inst.evicted = false;
      inst.live = null;
      sharedLive.delete(address);
      trace.push('revive', address);
    }
    if (isPartitioned(partitions, caller, address)) {
      throw new TypeError(`network error: partitioned ${caller} -> ${address}`);
    }
    if (inst.live != null) return inst.live;
    const cached = sharedLive.get(address);
    if (cached != null) {
      inst.live = cached;
      return cached;
    }
    const topologyAddress =
      system.addressOf(resource) ?? address.split(':')[0]!;
    const factory =
      factoryByResource.get(resource) ?? getResourceFactory(resource);
    let live: unknown;
    if (factory) {
      const deps = await resolveDeps({
        resource,
        ownerAddress: address,
        caller: address,
        system,
        worldRef,
      });
      trace.push('build', address);
      live = await factory(deps, buildCtx(address));
    } else {
      const provider = findProvider(options.provide, address);
      assert.ok(!!provider, `no impl or provider for '${address}'`);
      live = await provider.create(address);
      trace.push('build', address, 'provider');
    }
    inst.live = live;
    sharedLive.set(address, live);
    void topologyAddress;
    return live;
  };

  worldRef.scheduleCall = async (from, to, method, run) => {
    bump();
    try {
      const target = instances.get(to);
      if (target?.down) {
        trace.push('drop', to, `${from}.${method}`);
        throw new TypeError(`network error: ${to} is down`);
      }
      if (target?.evicted) {
        target.evicted = false;
        target.live = null;
        sharedLive.delete(to);
        trace.push('revive', to);
      }
      if (isPartitioned(partitions, from, to)) {
        trace.push('drop', to, `partition ${from}->${to} ${method}`);
        throw new TypeError(`network error: partitioned ${from} -> ${to}`);
      }
      trace.push('call', to, `${from}.${method}`);
      const result = await run();
      trace.push('reply', to, `${from}.${method}`);
      return result;
    } finally {
      done();
    }
  };
}
