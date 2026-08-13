import {
  getResourceDeps,
  isResourceKeyed,
  type ResourceRef,
  type SystemDefinition,
} from '../system';
import type { World } from './world';
import { isPartitioned, isRootInstanceAddress } from './world-runtime';

export type WorldTopologyNode = {
  readonly address: string;
  readonly kind: string;
  readonly down: boolean;
};

export type WorldTopologyEdge = {
  readonly from: string;
  readonly to: string;
  readonly kind: string;
  readonly partitioned: boolean;
};

export type WorldTopologySpawn = Readonly<
  Record<
    string,
    {
      readonly edges: readonly {
        readonly to: string;
        readonly kind: string;
      }[];
    }
  >
>;

/** Live root instances + dep edges + partitions (system-native, no report shape). */
export type WorldTopology = {
  readonly nodes: readonly WorldTopologyNode[];
  readonly edges: readonly WorldTopologyEdge[];
  readonly spawn: WorldTopologySpawn;
};

function rootKind(address: string): string {
  return address.split(':')[0] ?? address;
}

function namedRootDeps(
  resource: ResourceRef,
  system: SystemDefinition
): ReadonlyArray<{ readonly to: string; readonly kind: string }> {
  const deps = getResourceDeps(resource);
  if (!deps) return [];
  const out: { to: string; kind: string }[] = [];
  for (const [depKey, child] of Object.entries(deps)) {
    if (isResourceKeyed(child)) continue;
    const rootAddr = system.addressOf(child);
    if (!rootAddr) continue;
    if (system.roots[rootAddr] !== child) continue;
    out.push({ to: rootAddr, kind: depKey });
  }
  return out;
}

function collectLiveEdges(
  world: World,
  system: SystemDefinition,
  rootAddresses: readonly string[]
): WorldTopologyEdge[] {
  const byKey = new Map<string, WorldTopologyEdge>();
  const put = (from: string, to: string, kind: string) => {
    const key = `${from}\0${to}\0${kind}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      from,
      to,
      kind,
      partitioned: isPartitioned(world.partitions, from, to),
    });
  };

  for (const from of rootAddresses) {
    const inst = world.instances.get(from);
    if (!inst) continue;
    for (const dep of namedRootDeps(inst.resource, system)) {
      put(from, dep.to, dep.kind);
    }
  }

  for (const key of world.partitions) {
    const sep = key.indexOf('|');
    if (sep <= 0) continue;
    const a = key.slice(0, sep);
    const b = key.slice(sep + 1);
    if (!isRootInstanceAddress(a) || !isRootInstanceAddress(b)) continue;
    put(a, b, rootKind(b));
  }

  return [...byKey.values()];
}

function buildSpawnTemplates(
  system: SystemDefinition,
  kinds: Iterable<string>
): WorldTopologySpawn {
  const spawn: Record<
    string,
    {
      readonly edges: readonly { readonly to: string; readonly kind: string }[];
    }
  > = {};
  for (const kind of kinds) {
    const rootRef = system.roots[kind];
    spawn[kind] = {
      edges: rootRef ? namedRootDeps(rootRef, system) : [],
    };
  }
  return spawn;
}

/**
 * Project live World instances + partitions into a system-native topology graph,
 * using system addresses (`api`, `events`, `client:alice`) as node ids.
 */
export function worldTopology(world: World): WorldTopology {
  const system = world.system;
  const rootAddresses = [...world.instances.keys()]
    .filter(isRootInstanceAddress)
    .sort();

  const kinds = new Set<string>();
  for (const id of rootAddresses) {
    kinds.add(rootKind(id));
  }

  const nodes = rootAddresses.map((address) => {
    const kind = rootKind(address);
    const inst = world.instances.get(address);
    return {
      address,
      kind,
      down: inst?.down === true,
    };
  });

  const edges = collectLiveEdges(world, system, rootAddresses);

  return {
    nodes,
    edges,
    spawn: buildSpawnTemplates(system, kinds),
  };
}
