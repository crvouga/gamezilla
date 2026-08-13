import type { SimulationReportTopology } from '@pkgs/system-console';
import {
  getResourceDeps,
  isPartitioned,
  isResourceKeyed,
  type ResourceRef,
  type SystemDefinition,
  type World,
} from '@pkgs/system';

const CLIENT_ATTRS = ['html', 'sqlite', 'ingress', 'egress'] as const;
const API_ATTRS = ['sqlite', 'ingress', 'egress'] as const;
const DEFAULT_ATTRS = ['ingress', 'egress'] as const;

type ReportEdge = {
  from: string;
  to: string;
  kind: string;
  state: 'up' | 'down';
};

function rootKind(address: string): string {
  return address.split(':')[0] ?? address;
}

function isRootInstanceAddress(address: string): boolean {
  return !address.includes('.');
}

function attributesFor(kind: string): readonly string[] {
  if (kind === 'client') return CLIENT_ATTRS;
  if (kind === 'api' || kind === 'db') return API_ATTRS;
  return DEFAULT_ATTRS;
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
): ReportEdge[] {
  const byKey = new Map<string, ReportEdge>();
  const put = (from: string, to: string, kind: string) => {
    const key = `${from}\0${to}\0${kind}`;
    if (byKey.has(key)) return;
    byKey.set(key, {
      from,
      to,
      kind,
      state: isPartitioned(world.partitions, from, to) ? 'down' : 'up',
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
): SimulationReportTopology['definition']['spawn'] {
  const spawn: Record<
    string,
    { readonly edges: readonly { readonly to: string; readonly kind: string }[] }
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
 * Project live World instances + partitions into the console report topology
 * shape, using system addresses (`api`, `events`, `client:alice`) as node ids.
 */
export function projectReportTopology(
  world: World,
  system: SystemDefinition,
  seed: string
): SimulationReportTopology {
  const rootAddresses = [...world.instances.keys()]
    .filter(isRootInstanceAddress)
    .sort();

  const kinds = new Map<string, readonly string[]>();
  for (const id of rootAddresses) {
    const kind = rootKind(id);
    if (!kinds.has(kind)) kinds.set(kind, attributesFor(kind));
  }

  const nodes = rootAddresses.map((id) => {
    const kind = rootKind(id);
    const inst = world.instances.get(id);
    return {
      id,
      kind,
      status: inst?.down ? 'down' : 'ok',
      attributes: [...attributesFor(kind)],
      clockSkewMs: 0,
    };
  });

  const edges = collectLiveEdges(world, system, rootAddresses);

  return {
    seed,
    fuzz: null,
    definition: {
      kinds: Object.fromEntries(
        [...kinds.entries()].map(([kind, attributes]) => [
          kind,
          { attributes: [...attributes] },
        ])
      ),
      nodes: nodes.map((n) => ({ id: n.id, kind: n.kind })),
      edges: edges.map((e) => ({ from: e.from, to: e.to, kind: e.kind })),
      spawn: buildSpawnTemplates(system, kinds.keys()),
    },
    nodes,
    edges: edges.map((e) => ({
      from: e.from,
      to: e.to,
      kind: e.kind,
      state: e.state,
      latencyMs: 0,
      jitterMs: 0,
      dropRate: 0,
      duplicateRate: 0,
      failWithRemaining: 0,
    })),
  };
}
