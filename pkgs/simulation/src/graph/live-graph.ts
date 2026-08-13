import type { Driver } from '@pkgs/ui-testing';

import type { EventLog } from '../events';
import {
  createEdgeHandle,
  createNodeHandle,
  type SimEdgeHandle,
  type SimNodeHandle,
} from '../handles';
import type { SimMesh } from '../network';
import type { LiveNodeAdapter, SimulationSystemHandle } from '../system-port';
import {
  defaultHtmlSpawnKind,
  kindHasHtml,
  type LiveNodeSnapshot,
  type NodeStatus,
  type TopologyDefinition,
  type TopologySnapshot,
} from '../topology';

type LiveEntry = {
  readonly adapter: LiveNodeAdapter;
  handle: SimNodeHandle;
  status: NodeStatus;
  clockSkewMs: number;
};

export type CreateLiveGraphArgs = {
  readonly definition: TopologyDefinition;
  readonly system: SimulationSystemHandle;
  readonly mesh: SimMesh;
  readonly events: EventLog;
  readonly seed: string;
  readonly fuzz: TopologySnapshot['fuzz'];
  readonly attachUi?: (
    nodeId: string,
    adapter: LiveNodeAdapter
  ) => Promise<Driver | undefined>;
};

export type LiveGraph = {
  readonly definition: TopologyDefinition;
  ensureStaticNodes(): Promise<void>;
  spawn(id: string, kind: string): Promise<SimNodeHandle>;
  node(id: string): SimNodeHandle;
  tryNode(id: string): SimNodeHandle | undefined;
  edge(from: string, to: string): SimEdgeHandle;
  actorKind(): string;
  listNodes(): readonly LiveNodeSnapshot[];
  topologySnapshot(): TopologySnapshot;
  collectHtmlViews(): Promise<
    readonly { readonly nodeId: string; readonly html: string }[]
  >;
  snapshotDatabases(): Promise<
    readonly { readonly nodeId: string; readonly bytes: Uint8Array }[]
  >;
  dispose(): Promise<void>;
};

export function createLiveGraph(args: CreateLiveGraphArgs): LiveGraph {
  const entries = new Map<string, LiveEntry>();
  const spawn = (id: string, kind: string) =>
    spawnNode({ args, entries, id, kind });

  return {
    definition: args.definition,
    async ensureStaticNodes() {
      for (const edge of args.definition.edges) {
        args.mesh.registerEdge(edge.from, edge.to, edge.kind);
      }
      for (const node of args.definition.nodes) {
        await spawn(node.id, node.kind);
      }
    },
    spawn,
    node(id) {
      const entry = entries.get(id);
      if (!entry) throw new Error(`LiveGraph.node: unknown node '${id}'`);
      return entry.handle;
    },
    tryNode: (id) => entries.get(id)?.handle,
    edge(from, to) {
      return createEdgeHandle({
        from,
        to,
        mesh: args.mesh,
        events: args.events,
      });
    },
    actorKind: () => {
      const kind = defaultHtmlSpawnKind(args.definition);
      if (!kind) {
        throw new Error('LiveGraph: no html spawn kind for actor()');
      }
      return kind;
    },
    listNodes: () => [...entries.values()].map((e) => e.handle.snapshot()),
    topologySnapshot: () => ({
      definition: args.definition,
      nodes: [...entries.values()].map((e) => e.handle.snapshot()),
      edges: args.mesh.listEdges(),
      seed: args.seed,
      fuzz: args.fuzz,
    }),
    collectHtmlViews: () => collectHtml(entries, args.definition),
    snapshotDatabases: () => collectSqlite(entries),
    async dispose() {
      for (const entry of [...entries.values()].reverse()) {
        try {
          await entry.adapter.dispose();
        } catch {
          // best-effort teardown
        }
      }
      entries.clear();
    },
  };
}

async function spawnNode(ctx: {
  readonly args: CreateLiveGraphArgs;
  readonly entries: Map<string, LiveEntry>;
  readonly id: string;
  readonly kind: string;
}): Promise<SimNodeHandle> {
  const { args, entries, id, kind } = ctx;
  const existing = entries.get(id);
  if (existing) return existing.handle;
  const kindDef = args.definition.kinds[kind];
  if (!kindDef) {
    throw new Error(`LiveGraph.spawn: unknown kind '${kind}'`);
  }
  const adapter = await args.system.spawn({ id, kind });
  for (const template of args.definition.spawn[kind]?.edges ?? []) {
    args.mesh.registerEdge(id, template.to, template.kind);
  }
  const ui = args.attachUi ? await args.attachUi(id, adapter) : undefined;
  const entry: LiveEntry = {
    adapter,
    status: 'ok',
    clockSkewMs: 0,
    handle: null as unknown as SimNodeHandle,
  };
  entry.handle = createNodeHandle({
    id,
    kind,
    attributes: kindDef.attributes,
    adapter,
    mesh: args.mesh,
    events: args.events,
    getStatus: () => entry.status,
    setStatus: (s) => {
      entry.status = s;
    },
    getClockSkewMs: () => entry.clockSkewMs,
    setClockSkewMs: (ms) => {
      entry.clockSkewMs = ms;
    },
    ...(ui !== undefined ? { ui } : {}),
  });
  entries.set(id, entry);
  args.events.append({ kind: 'node.spawn', nodeId: id, detail: kind });
  return entry.handle;
}

async function collectHtml(
  entries: Map<string, LiveEntry>,
  definition: TopologyDefinition
): Promise<readonly { readonly nodeId: string; readonly html: string }[]> {
  const out: { nodeId: string; html: string }[] = [];
  for (const [id, entry] of entries) {
    if (!kindHasHtml(definition, entry.handle.kind)) continue;
    const ui = entry.handle.ui;
    if (!ui) continue;
    try {
      const html = await ui.snapshotHtml({
        stylesheetHref: '../../snapshot-shell.css',
      });
      if (html != null) out.push({ nodeId: id, html });
    } catch {
      // mid-dispose
    }
  }
  return out;
}

async function collectSqlite(
  entries: Map<string, LiveEntry>
): Promise<readonly { readonly nodeId: string; readonly bytes: Uint8Array }[]> {
  const out: { nodeId: string; bytes: Uint8Array }[] = [];
  for (const [id, entry] of entries) {
    try {
      const snap = await entry.adapter.snapshot('sqlite');
      if (
        snap?.kind === 'sqlite' &&
        'bytes' in snap &&
        snap.bytes instanceof Uint8Array
      ) {
        out.push({ nodeId: id, bytes: snap.bytes });
      }
    } catch {
      // skip
    }
  }
  return out;
}
