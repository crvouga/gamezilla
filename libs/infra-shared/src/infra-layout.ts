/**
 * A small layered (Sugiyama-style) graph layout: longest-path layers, a few
 * barycenter sweeps to reduce crossings, then left-to-right coordinates.
 * Deterministic: the same graph always lays out the same way, so a
 * regenerated page only changes when the infrastructure does.
 */

export type LayoutNode = {
  readonly id: string;
  readonly width: number;
  readonly height: number;
};

export type LayoutEdge = { readonly from: string; readonly to: string };

export type Placed = LayoutNode & {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
};

export type Route = {
  readonly from: string;
  readonly to: string;
  readonly path: string;
  readonly back: boolean;
};

export type Layout = {
  readonly nodes: readonly Placed[];
  readonly routes: readonly Route[];
  readonly width: number;
  readonly height: number;
};

export type LayoutOptions = {
  readonly gapX: number;
  readonly gapY: number;
  readonly pad: number;
};

/** Edges that point to unknown nodes, loops and duplicates are dropped. */
function cleanEdges(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[]
): LayoutEdge[] {
  const ids = new Set(nodes.map((n) => n.id));
  const seen = new Set<string>();
  const out: LayoutEdge[] = [];
  for (const edge of edges) {
    const key = `${edge.from}\u0000${edge.to}`;
    if (!ids.has(edge.from) || !ids.has(edge.to) || edge.from === edge.to) {
      continue;
    }
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(edge);
  }
  return out;
}

/** Split edges into a DAG (kept) and back edges (reversed for layering). */
function breakCycles(
  nodes: readonly LayoutNode[],
  edges: readonly LayoutEdge[]
): { forward: LayoutEdge[]; back: LayoutEdge[] } {
  const out = new Map<string, LayoutEdge[]>();
  for (const edge of edges) {
    out.set(edge.from, [...(out.get(edge.from) ?? []), edge]);
  }
  const state = new Map<string, 'open' | 'done'>();
  const back = new Set<LayoutEdge>();
  const visit = (id: string): void => {
    state.set(id, 'open');
    for (const edge of out.get(id) ?? []) {
      const next = state.get(edge.to);
      if (next === 'open') back.add(edge);
      else if (next === undefined) visit(edge.to);
    }
    state.set(id, 'done');
  };
  for (const node of nodes) {
    if (!state.has(node.id)) visit(node.id);
  }
  return {
    forward: edges.filter((e) => !back.has(e)),
    back: edges.filter((e) => back.has(e)),
  };
}

function assignLayers(
  nodes: readonly LayoutNode[],
  forward: readonly LayoutEdge[]
): Map<string, number> {
  const layer = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  for (let pass = 0; pass < nodes.length; pass += 1) {
    let changed = false;
    for (const edge of forward) {
      const next = (layer.get(edge.from) ?? 0) + 1;
      if (next > (layer.get(edge.to) ?? 0)) {
        layer.set(edge.to, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return layer;
}

function barycenter(
  id: string,
  neighbours: ReadonlyMap<string, readonly string[]>,
  position: ReadonlyMap<string, number>
): number | null {
  const around = neighbours.get(id) ?? [];
  if (around.length === 0) return null;
  const total = around.reduce((sum, n) => sum + (position.get(n) ?? 0), 0);
  return total / around.length;
}

function orderLayers(layers: string[][], forward: readonly LayoutEdge[]): void {
  const preds = new Map<string, string[]>();
  const succs = new Map<string, string[]>();
  for (const e of forward) {
    preds.set(e.to, [...(preds.get(e.to) ?? []), e.from]);
    succs.set(e.from, [...(succs.get(e.from) ?? []), e.to]);
  }
  const positions = (): Map<string, number> => {
    const map = new Map<string, number>();
    for (const column of layers) {
      column.forEach((id, index) => map.set(id, index));
    }
    return map;
  };
  for (let sweep = 0; sweep < 6; sweep += 1) {
    const down = sweep % 2 === 0;
    const order = down ? layers : [...layers].reverse();
    for (const column of order) {
      const position = positions();
      const keyed = column.map((id, index) => ({
        id,
        key: barycenter(id, down ? preds : succs, position) ?? index,
      }));
      keyed.sort((a, b) => a.key - b.key);
      column.splice(0, column.length, ...keyed.map((k) => k.id));
    }
  }
}

/** Smooth left-to-right curve through the given points. */
function curve(points: readonly { x: number; y: number }[]): string {
  const [first, ...rest] = points;
  if (first === undefined) return '';
  let d = `M${first.x},${first.y}`;
  let prev = first;
  for (const p of rest) {
    const dx = Math.max(24, (p.x - prev.x) / 2);
    d += ` C${prev.x + dx},${prev.y} ${p.x - dx},${p.y} ${p.x},${p.y}`;
    prev = p;
  }
  return d;
}

function backPath(from: Placed, to: Placed): string {
  const lift = Math.max(from.height, to.height) / 2 + 22;
  const top = Math.min(from.y, to.y) - lift;
  const x1 = from.x + from.width / 2;
  const x2 = to.x + to.width / 2;
  return `M${x1},${from.y} C${x1},${top} ${x2},${top} ${x2},${to.y}`;
}

const DUMMY_HEIGHT = 10;

type Chains = {
  readonly nodes: LayoutNode[];
  readonly edges: LayoutEdge[];
  /** Edge key → the dummy node ids its route passes through, in order. */
  readonly via: Map<string, string[]>;
  readonly layers: Map<string, number>;
};

/** Give every edge that skips layers a dummy node in each layer it crosses. */
function chainLongEdges(
  forward: readonly LayoutEdge[],
  layerOf: ReadonlyMap<string, number>
): Chains {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const via = new Map<string, string[]>();
  const layers = new Map<string, number>();
  for (const edge of forward) {
    const a = layerOf.get(edge.from) ?? 0;
    const b = layerOf.get(edge.to) ?? 0;
    const ids: string[] = [];
    for (let layer = a + 1; layer < b; layer += 1) {
      const id = `\u0000dummy:${edge.from}>${edge.to}:${layer}`;
      ids.push(id);
      layers.set(id, layer);
      nodes.push({ id, width: 0, height: DUMMY_HEIGHT });
    }
    const path = [edge.from, ...ids, edge.to];
    for (let k = 0; k + 1 < path.length; k += 1) {
      edges.push({ from: path[k] as string, to: path[k + 1] as string });
    }
    via.set(`${edge.from}\u0000${edge.to}`, ids);
  }
  return { nodes, edges, via, layers };
}

export function layoutLayered(
  inputNodes: readonly LayoutNode[],
  inputEdges: readonly LayoutEdge[],
  options: LayoutOptions
): Layout {
  if (inputNodes.length === 0) {
    return { nodes: [], routes: [], width: 0, height: 0 };
  }
  const edges = cleanEdges(inputNodes, inputEdges);
  const { forward, back } = breakCycles(inputNodes, edges);
  const layerOf = assignLayers(inputNodes, forward);
  const chains = chainLongEdges(forward, layerOf);
  const all = [...inputNodes, ...chains.nodes];
  for (const [id, layer] of chains.layers) layerOf.set(id, layer);
  const depth = Math.max(...layerOf.values()) + 1;
  const layers: string[][] = Array.from({ length: depth }, () => []);
  for (const node of all) layers[layerOf.get(node.id) ?? 0]?.push(node.id);
  orderLayers(layers, chains.edges);
  const byId = new Map(all.map((n) => [n.id, n]));
  const heights = layers.map((column) =>
    column.reduce(
      (sum, id, i) =>
        sum + (byId.get(id)?.height ?? 0) + (i > 0 ? options.gapY : 0),
      0
    )
  );
  const innerHeight = Math.max(...heights);
  const placed = new Map<string, Placed>();
  const top = back.length > 0 ? 40 : 0;
  let x = options.pad;
  layers.forEach((column, layer) => {
    const colWidth = Math.max(
      ...column.map((id) => byId.get(id)?.width ?? 0),
      0
    );
    let y = options.pad + top + (innerHeight - (heights[layer] ?? 0)) / 2;
    for (const id of column) {
      const node = byId.get(id) as LayoutNode;
      const cx = node.width === 0 ? x + colWidth / 2 : x;
      placed.set(id, { ...node, x: cx, y, layer });
      y += node.height + options.gapY;
    }
    x += colWidth + options.gapX;
  });
  const routes: Route[] = [
    ...forward.map((e) => ({ e, back: false })),
    ...back.map((e) => ({ e, back: true })),
  ].map(({ e, back: isBack }) => {
    const from = placed.get(e.from) as Placed;
    const to = placed.get(e.to) as Placed;
    if (isBack) {
      return { from: e.from, to: e.to, back: true, path: backPath(from, to) };
    }
    const middle = (chains.via.get(`${e.from}\u0000${e.to}`) ?? []).map(
      (id) => {
        const d = placed.get(id) as Placed;
        return { x: d.x, y: d.y + d.height / 2 };
      }
    );
    const points = [
      { x: from.x + from.width, y: from.y + from.height / 2 },
      ...middle,
      { x: to.x, y: to.y + to.height / 2 },
    ];
    return { from: e.from, to: e.to, back: false, path: curve(points) };
  });
  const real = [...placed.values()].filter((n) => n.width > 0);
  return {
    nodes: real,
    routes,
    width: x - options.gapX + options.pad,
    height: innerHeight + options.pad * 2 + top,
  };
}
