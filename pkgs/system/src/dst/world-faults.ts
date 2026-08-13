import { assert } from '@pkgs/assert';

import type { ResourceRef, SystemDefinition } from '../system';
import type { ProviderSpec } from './providers';
import type { Trace } from './trace';
import {
  findProvider,
  type InstanceState,
  partitionKey,
} from './world-runtime';

export function makeFaults(args: {
  instances: Map<string, InstanceState>;
  sharedLive: Map<string, unknown>;
  partitions: Set<string>;
  trace: Trace;
  system: SystemDefinition;
  provide: Record<string, ProviderSpec>;
  ensureInstance: (address: string, resource: ResourceRef) => InstanceState;
}) {
  const {
    instances,
    sharedLive,
    partitions,
    trace,
    system,
    provide,
    ensureInstance,
  } = args;

  return {
    crash(address: string) {
      const root = address.split(':')[0] ?? address;
      const resource = system.resourceAt(root) ?? system.roots[root];
      assert.ok(!!resource, `unknown address '${address}'`);
      const inst = ensureInstance(address, resource);
      inst.down = true;
      inst.live = null;
      sharedLive.delete(address);
      trace.push('fault', address, 'crash');
    },
    restart(address: string) {
      const inst = instances.get(address);
      if (inst) {
        inst.down = false;
        inst.live = null;
        inst.evicted = false;
      }
      sharedLive.delete(address);
      trace.push('fault', address, 'restart');
    },
    evict(address: string) {
      const inst = instances.get(address);
      if (inst) {
        inst.evicted = true;
        inst.live = null;
        inst.down = false;
      }
      sharedLive.delete(address);
      trace.push('fault', address, 'evict');
    },
    partition(a: string, b: string) {
      partitions.add(partitionKey(a, b));
      trace.push('fault', a, `partition ${b}`);
    },
    heal(a?: string, b?: string) {
      if (a === undefined) {
        partitions.clear();
        trace.push('fault', '*', 'heal-all');
        return;
      }
      if (b === undefined) {
        for (const key of [...partitions]) {
          if (key.includes(a)) partitions.delete(key);
        }
        trace.push('fault', a, 'heal');
        return;
      }
      partitions.delete(partitionKey(a, b));
      trace.push('fault', a, `heal ${b}`);
    },
    async corrupt(addr: string) {
      const provider = findProvider(provide, addr);
      assert.ok(!!provider?.corrupt, `no corrupt hook for '${addr}'`);
      await provider.corrupt(addr);
      trace.push('fault', addr, 'corrupt');
    },
    async wipe(addr: string) {
      const provider = findProvider(provide, addr);
      assert.ok(!!provider?.wipe, `no wipe hook for '${addr}'`);
      await provider.wipe(addr);
      const inst = instances.get(addr);
      if (inst) inst.live = null;
      sharedLive.delete(addr);
      // Owners that closed over this leaf must rebuild on next use.
      const dot = addr.lastIndexOf('.');
      if (dot > 0) {
        const owner = addr.slice(0, dot);
        const parent = instances.get(owner);
        if (parent) parent.live = null;
        sharedLive.delete(owner);
      }
      trace.push('fault', addr, 'wipe');
    },
  };
}
