/**
 * Where a window layout puts things, as fractions of the area it fills.
 *
 * The renderer positions every window, divider and panel from these
 * rectangles instead of nesting elements like the tree, so a panel's element
 * never moves in the document when the layout changes. Drop targets and
 * neighbours are read from the same rectangles, which is what keeps the
 * pointer, the keyboard and a script in agreement.
 */

import {
  sumSizes,
  WINDOW_MIN_SHARE,
  type WindowEdge,
  type WindowLayout,
  type WindowLayoutCommand,
  type WindowNode,
  type WindowSplit,
  type WindowSplitDirection,
} from './window-layout';

/** A rectangle in fractions (0..1) of the window manager's area. */
export type WindowRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

export type WindowFrame = { readonly id: string; readonly rect: WindowRect };

export type WindowSeparatorFrame = {
  readonly split: string;
  /** The divider sits after child `index`. */
  readonly index: number;
  readonly direction: WindowSplitDirection;
  /** The dividing line: zero wide in a `row`, zero high in a `column`. */
  readonly rect: WindowRect;
  /** How much of the area the split spans along its direction. */
  readonly extent: number;
  /** Share of the split before the divider, in percent, with its limits. */
  readonly value: number;
  readonly min: number;
  readonly max: number;
};

export type WindowFrames = {
  readonly windows: readonly WindowFrame[];
  readonly separators: readonly WindowSeparatorFrame[];
};

const WHOLE: WindowRect = { left: 0, top: 0, width: 1, height: 1 };

function childRect(
  node: WindowSplit,
  rect: WindowRect,
  span: readonly [number, number]
): WindowRect {
  const [start, size] = span;
  return node.direction === 'row'
    ? {
        ...rect,
        left: rect.left + rect.width * start,
        width: rect.width * size,
      }
    : {
        ...rect,
        top: rect.top + rect.height * start,
        height: rect.height * size,
      };
}

function separatorFrame(
  node: WindowSplit,
  rect: WindowRect,
  at: { readonly index: number; readonly end: number }
): WindowSeparatorFrame {
  const total = sumSizes(node.sizes);
  const before = sumSizes(node.sizes.slice(0, at.index)) / total;
  const pair =
    ((node.sizes[at.index] ?? 0) + (node.sizes[at.index + 1] ?? 0)) / total;
  const floor = Math.min(WINDOW_MIN_SHARE, pair / 2);
  const percent = (share: number): number => Math.round(share * 1000) / 10;
  return {
    split: node.id,
    index: at.index,
    direction: node.direction,
    rect:
      node.direction === 'row'
        ? { ...rect, left: rect.left + rect.width * at.end, width: 0 }
        : { ...rect, top: rect.top + rect.height * at.end, height: 0 },
    extent: node.direction === 'row' ? rect.width : rect.height,
    value: percent(at.end),
    min: percent(before + floor),
    max: percent(before + pair - floor),
  };
}

function place(
  node: WindowNode,
  rect: WindowRect,
  out: { windows: WindowFrame[]; separators: WindowSeparatorFrame[] }
): void {
  if (node.type === 'window') {
    out.windows.push({ id: node.id, rect });
    return;
  }
  const total = sumSizes(node.sizes);
  let start = 0;
  for (const [index, child] of node.children.entries()) {
    const size = (node.sizes[index] ?? 1) / total;
    place(child, childRect(node, rect, [start, size]), out);
    start += size;
    if (index < node.children.length - 1)
      out.separators.push(separatorFrame(node, rect, { index, end: start }));
  }
}

/**
 * The rectangle of every visible window and divider. A maximized window is
 * the only one, over the whole area, with no dividers.
 */
export function windowFrames(layout: WindowLayout): WindowFrames {
  if (layout.root === null) return { windows: [], separators: [] };
  if (layout.maximized !== null)
    return { windows: [{ id: layout.maximized, rect: WHOLE }], separators: [] };
  const out = { windows: [], separators: [] };
  place(layout.root, WHOLE, out);
  return out;
}

const EPSILON = 1e-6;

function overlap(a: readonly [number, number], b: readonly [number, number]) {
  return Math.min(a[0] + a[1], b[0] + b[1]) - Math.max(a[0], b[0]);
}

/** How much of `other` borders `rect` on `edge`; zero or less when it does not. */
function borderShared(
  rect: WindowRect,
  other: WindowRect,
  edge: WindowEdge
): number {
  const horizontal = edge === 'left' || edge === 'right';
  const gap = {
    left: rect.left - (other.left + other.width),
    right: other.left - (rect.left + rect.width),
    top: rect.top - (other.top + other.height),
    bottom: other.top - (rect.top + rect.height),
  }[edge];
  if (Math.abs(gap) > EPSILON) return 0;
  return horizontal
    ? overlap([rect.top, rect.height], [other.top, other.height])
    : overlap([rect.left, rect.width], [other.left, other.width]);
}

/** The window that borders `window` on `edge`, sharing the most of that edge. */
export function windowNeighbor(
  layout: WindowLayout,
  window: string,
  edge: WindowEdge
): string | null {
  const frames = windowFrames({ ...layout, maximized: null }).windows;
  const own = frames.find((frame) => frame.id === window);
  if (own === undefined) return null;
  let best: { id: string; shared: number } | null = null;
  for (const frame of frames) {
    if (frame.id === window) continue;
    const shared = borderShared(own.rect, frame.rect, edge);
    if (shared > EPSILON && (best === null || shared > best.shared + EPSILON))
      best = { id: frame.id, shared };
  }
  return best?.id ?? null;
}

/** Where in a window a dragged panel lands. */
export type WindowDropZone = 'tabs' | 'center' | WindowEdge;

export type WindowDropTarget = {
  readonly window: string;
  readonly zone: WindowDropZone;
  /** What the drop would cover: half the window for an edge, else all of it. */
  readonly rect: WindowRect;
};

/** A window's outer quarter on each side splits it; the middle joins its tabs. */
export const WINDOW_EDGE_ZONE = 0.25;

function halfRect(rect: WindowRect, edge: WindowEdge): WindowRect {
  if (edge === 'left') return { ...rect, width: rect.width / 2 };
  if (edge === 'top') return { ...rect, height: rect.height / 2 };
  if (edge === 'right')
    return { ...rect, left: rect.left + rect.width / 2, width: rect.width / 2 };
  return { ...rect, top: rect.top + rect.height / 2, height: rect.height / 2 };
}

function zoneAt(
  rect: WindowRect,
  point: { readonly x: number; readonly y: number },
  tabBarHeight: number
): WindowDropZone {
  if (point.y - rect.top < tabBarHeight) return 'tabs';
  const distance: Readonly<Record<WindowEdge, number>> = {
    left: (point.x - rect.left) / rect.width,
    right: (rect.left + rect.width - point.x) / rect.width,
    top: (point.y - rect.top - tabBarHeight) / (rect.height - tabBarHeight),
    bottom: (rect.top + rect.height - point.y) / rect.height,
  };
  let nearest: WindowEdge = 'left';
  for (const edge of ['right', 'top', 'bottom'] as const)
    if (distance[edge] < distance[nearest]) nearest = edge;
  return distance[nearest] < WINDOW_EDGE_ZONE ? nearest : 'center';
}

/**
 * The drop target under `point` (fractions of the area). `tabBarHeight` is
 * the height of a window's tab bar as a fraction of the area.
 */
export function windowDropTarget(args: {
  readonly frames: readonly WindowFrame[];
  readonly point: { readonly x: number; readonly y: number };
  readonly tabBarHeight: number;
}): WindowDropTarget | null {
  const { point } = args;
  const frame = args.frames.find(
    ({ rect }) =>
      point.x >= rect.left &&
      point.x <= rect.left + rect.width &&
      point.y >= rect.top &&
      point.y <= rect.top + rect.height
  );
  if (frame === undefined) return null;
  const zone = zoneAt(frame.rect, point, args.tabBarHeight);
  return {
    window: frame.id,
    zone,
    rect:
      zone === 'tabs' || zone === 'center'
        ? frame.rect
        : halfRect(frame.rect, zone),
  };
}

/** The command a drop makes: join a tab bar, or split on an edge. */
export function windowDropCommand(
  panel: string,
  target: WindowDropTarget,
  index?: number
): WindowLayoutCommand {
  if (target.zone === 'tabs')
    return { type: 'move', panel, window: target.window, index };
  if (target.zone === 'center')
    return { type: 'move', panel, window: target.window };
  return { type: 'split', panel, window: target.window, edge: target.zone };
}
