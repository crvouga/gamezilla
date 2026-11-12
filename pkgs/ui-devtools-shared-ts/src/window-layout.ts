/**
 * The layout of a window manager, as plain data.
 *
 * A layout is a tree: a **window** is a tab bar over one visible panel, and a
 * **split** lays its children out side by side (`row`) or stacked (`column`).
 * Panels are named by the caller's ids; the tree never holds content.
 *
 * Every change is a {@link WindowLayoutCommand} applied by
 * {@link applyWindowLayoutCommand}, a pure function, so a pointer drag, a
 * keyboard shortcut, a menu row and a script all make the same change the
 * same way. The result is always canonical: no empty window, no split with
 * fewer than two children, no split nested in a split of its own direction.
 */

export type WindowSplitDirection = 'row' | 'column';

/** The edge of a window a panel is dropped on. */
export type WindowEdge = 'left' | 'right' | 'top' | 'bottom';

export const WINDOW_EDGES: readonly WindowEdge[] = [
  'left',
  'right',
  'top',
  'bottom',
];

export type WindowGroup = {
  readonly type: 'window';
  readonly id: string;
  /** Panel ids in tab order; never empty. */
  readonly tabs: readonly string[];
  /** The visible panel; always one of `tabs`. */
  readonly active: string;
};

export type WindowSplit = {
  readonly type: 'split';
  readonly id: string;
  readonly direction: WindowSplitDirection;
  /** Two or more children. */
  readonly children: readonly WindowNode[];
  /** One positive weight per child; a child's share is its weight over the sum. */
  readonly sizes: readonly number[];
};

export type WindowNode = WindowGroup | WindowSplit;

export type WindowLayout = {
  readonly root: WindowNode | null;
  /** The window keyboard commands act on. */
  readonly focused: string | null;
  /** A window shown alone over the whole area; the rest keep their place. */
  readonly maximized: string | null;
};

export type WindowLayoutCommand =
  /** Show a panel and focus its window. */
  | { readonly type: 'select'; readonly panel: string }
  | { readonly type: 'focus'; readonly window: string }
  /** Put a panel in a window's tab bar, at `index` among its other tabs. */
  | {
      readonly type: 'move';
      readonly panel: string;
      readonly window: string;
      readonly index?: number | undefined;
    }
  /** Put a panel in a new window on one edge of an existing window. */
  | {
      readonly type: 'split';
      readonly panel: string;
      readonly window: string;
      readonly edge: WindowEdge;
    }
  /** Show a panel, adding it to the focused window when it is closed. */
  | { readonly type: 'open'; readonly panel: string }
  | { readonly type: 'close'; readonly panel: string }
  /**
   * Move the divider after child `index` of a split by `delta`, a fraction of
   * the split's extent (negative is toward the start).
   */
  | {
      readonly type: 'resize';
      readonly split: string;
      readonly index: number;
      readonly delta: number;
    }
  /** Give the children of a split (or of every split) equal shares. */
  | { readonly type: 'equalize'; readonly split?: string | undefined }
  | { readonly type: 'maximize'; readonly window: string }
  | { readonly type: 'restore' };

/** The smallest share of a split a divider leaves either neighbour. */
export const WINDOW_MIN_SHARE = 0.1;

export const EMPTY_WINDOW_LAYOUT: WindowLayout = {
  root: null,
  focused: null,
  maximized: null,
};

export function sumSizes(sizes: readonly number[]): number {
  return sizes.reduce((total, size) => total + size, 0);
}

/** Every window, in reading order. */
export function windowGroups(layout: WindowLayout): readonly WindowGroup[] {
  const out: WindowGroup[] = [];
  const walk = (node: WindowNode): void => {
    if (node.type === 'window') out.push(node);
    else for (const child of node.children) walk(child);
  };
  if (layout.root !== null) walk(layout.root);
  return out;
}

export function windowSplits(layout: WindowLayout): readonly WindowSplit[] {
  const out: WindowSplit[] = [];
  const walk = (node: WindowNode): void => {
    if (node.type === 'window') return;
    out.push(node);
    for (const child of node.children) walk(child);
  };
  if (layout.root !== null) walk(layout.root);
  return out;
}

/** Every open panel, in reading order. */
export function windowPanels(layout: WindowLayout): readonly string[] {
  return windowGroups(layout).flatMap((group) => group.tabs);
}

export function windowById(
  layout: WindowLayout,
  id: string | null
): WindowGroup | null {
  if (id === null) return null;
  return windowGroups(layout).find((group) => group.id === id) ?? null;
}

/** The window whose tab bar holds `panel`. */
export function windowOfPanel(
  layout: WindowLayout,
  panel: string
): WindowGroup | null {
  return (
    windowGroups(layout).find((group) => group.tabs.includes(panel)) ?? null
  );
}

/** A fresh id (`w4`, `s2`) that no node of the layout has. */
function freshId(layout: WindowLayout, prefix: 'w' | 's'): string {
  const taken = [...windowGroups(layout), ...windowSplits(layout)].map(
    (node) => node.id
  );
  let next = 1;
  while (taken.includes(`${prefix}${String(next)}`)) next += 1;
  return `${prefix}${String(next)}`;
}

/** A child that is a split of its parent's direction joins the parent. */
function absorb(
  parent: WindowSplitDirection,
  child: WindowNode,
  size: number
): readonly (readonly [WindowNode, number])[] {
  if (child.type !== 'split' || child.direction !== parent)
    return [[child, size]];
  const total = sumSizes(child.sizes);
  return child.children.map(
    (inner, index) =>
      [inner, (size * (child.sizes[index] ?? 1)) / total] as const
  );
}

/**
 * Rebuilds the tree, replacing each window with what `visit` returns (`null`
 * removes it) and each split with what `revisit` returns, and restores the
 * canonical shape on the way up.
 */
function rebuild(
  node: WindowNode,
  visit: (group: WindowGroup) => WindowNode | null,
  revisit: (split: WindowSplit) => WindowSplit = (split) => split
): WindowNode | null {
  if (node.type === 'window') return visit(node);
  const kept: (readonly [WindowNode, number])[] = [];
  for (const [index, child] of node.children.entries()) {
    const next = rebuild(child, visit, revisit);
    if (next === null) continue;
    kept.push(...absorb(node.direction, next, node.sizes[index] ?? 1));
  }
  if (kept.length === 0) return null;
  if (kept.length === 1) return kept[0]?.[0] ?? null;
  return revisit({
    ...node,
    children: kept.map(([child]) => child),
    sizes: kept.map(([, size]) => size),
  });
}

/** Focus and maximize name windows that exist, or nothing. */
function settle(layout: WindowLayout): WindowLayout {
  const groups = windowGroups(layout);
  const has = (id: string | null): boolean =>
    groups.some((group) => group.id === id);
  return {
    root: layout.root,
    focused: has(layout.focused) ? layout.focused : (groups[0]?.id ?? null),
    maximized: has(layout.maximized) ? layout.maximized : null,
  };
}

function withoutTab(group: WindowGroup, panel: string): WindowGroup | null {
  const at = group.tabs.indexOf(panel);
  if (at === -1) return group;
  const tabs = group.tabs.filter((tab) => tab !== panel);
  const next = tabs[Math.min(at, tabs.length - 1)];
  if (next === undefined) return null;
  return {
    ...group,
    tabs,
    active: group.active === panel ? next : group.active,
  };
}

function detach(root: WindowNode | null, panel: string): WindowNode | null {
  if (root === null) return null;
  return rebuild(root, (group) => withoutTab(group, panel));
}

function replaceWindow(
  root: WindowNode | null,
  id: string,
  change: (group: WindowGroup) => WindowNode
): WindowNode | null {
  if (root === null) return null;
  return rebuild(root, (group) => (group.id === id ? change(group) : group));
}

function withTab(
  group: WindowGroup,
  panel: string,
  index: number
): WindowGroup {
  const at = Math.max(0, Math.min(index, group.tabs.length));
  return {
    ...group,
    tabs: [...group.tabs.slice(0, at), panel, ...group.tabs.slice(at)],
    active: panel,
  };
}

function select(layout: WindowLayout, panel: string): WindowLayout {
  const group = windowOfPanel(layout, panel);
  if (group === null) return layout;
  return {
    ...layout,
    root: replaceWindow(layout.root, group.id, (g) => ({
      ...g,
      active: panel,
    })),
    focused: group.id,
    maximized: layout.maximized === null ? null : group.id,
  };
}

function move(
  layout: WindowLayout,
  command: Extract<WindowLayoutCommand, { type: 'move' }>
): WindowLayout {
  const target = windowById(layout, command.window);
  if (target === null) return layout;
  const others = target.tabs.filter((tab) => tab !== command.panel);
  const index = command.index ?? others.length;
  // The target survives the detach unless the panel is its only tab.
  const root =
    others.length === 0
      ? layout.root
      : replaceWindow(detach(layout.root, command.panel), target.id, (group) =>
          withTab(group, command.panel, index)
        );
  return select({ ...layout, root }, command.panel);
}

function split(
  layout: WindowLayout,
  command: Extract<WindowLayoutCommand, { type: 'split' }>
): WindowLayout {
  const target = windowById(layout, command.window);
  if (target === null) return layout;
  // A window cannot be split by its only panel.
  if (target.tabs.length === 1 && target.active === command.panel)
    return select(layout, command.panel);
  const created: WindowGroup = {
    type: 'window',
    id: freshId(layout, 'w'),
    tabs: [command.panel],
    active: command.panel,
  };
  const before = command.edge === 'left' || command.edge === 'top';
  const direction: WindowSplitDirection =
    command.edge === 'left' || command.edge === 'right' ? 'row' : 'column';
  const id = freshId(layout, 's');
  const root = replaceWindow(
    detach(layout.root, command.panel),
    target.id,
    (group) => ({
      type: 'split',
      id,
      direction,
      children: before ? [created, group] : [group, created],
      sizes: [1, 1],
    })
  );
  return select({ ...layout, root }, command.panel);
}

function open(layout: WindowLayout, panel: string): WindowLayout {
  if (windowOfPanel(layout, panel) !== null) return select(layout, panel);
  const home = windowById(layout, layout.focused) ?? windowGroups(layout)[0];
  if (home !== undefined)
    return move(layout, { type: 'move', panel, window: home.id });
  const id = freshId(layout, 'w');
  return {
    root: { type: 'window', id, tabs: [panel], active: panel },
    focused: id,
    maximized: null,
  };
}

function resized(node: WindowSplit, index: number, delta: number): WindowSplit {
  const a = node.sizes[index];
  const b = node.sizes[index + 1];
  if (a === undefined || b === undefined || !Number.isFinite(delta))
    return node;
  const total = sumSizes(node.sizes);
  const floor = Math.min(WINDOW_MIN_SHARE * total, (a + b) / 2);
  const next = Math.max(floor, Math.min(a + b - floor, a + delta * total));
  return {
    ...node,
    sizes: node.sizes.map((size, at) => {
      if (at === index) return next;
      return at === index + 1 ? a + b - next : size;
    }),
  };
}

function mapSplits(
  layout: WindowLayout,
  change: (node: WindowSplit) => WindowSplit
): WindowLayout {
  if (layout.root === null) return layout;
  return { ...layout, root: rebuild(layout.root, (group) => group, change) };
}

function applied(
  layout: WindowLayout,
  command: WindowLayoutCommand
): WindowLayout {
  if (command.type === 'select') return select(layout, command.panel);
  if (command.type === 'move') return move(layout, command);
  if (command.type === 'split') return split(layout, command);
  if (command.type === 'open') return open(layout, command.panel);
  if (command.type === 'close')
    return { ...layout, root: detach(layout.root, command.panel) };
  if (command.type === 'focus') {
    const exists = windowById(layout, command.window) !== null;
    if (!exists) return layout;
    return {
      ...layout,
      focused: command.window,
      maximized: layout.maximized === null ? null : command.window,
    };
  }
  if (command.type === 'resize')
    return mapSplits(layout, (node) =>
      node.id === command.split
        ? resized(node, command.index, command.delta)
        : node
    );
  if (command.type === 'equalize')
    return mapSplits(layout, (node) =>
      command.split === undefined || command.split === node.id
        ? { ...node, sizes: node.sizes.map(() => 1) }
        : node
    );
  if (command.type === 'maximize')
    return { ...layout, focused: command.window, maximized: command.window };
  return { ...layout, maximized: null };
}

/**
 * The layout after `command`. A command that names a window, split or panel
 * the layout does not have changes nothing.
 */
export function applyWindowLayoutCommand(
  layout: WindowLayout,
  command: WindowLayoutCommand
): WindowLayout {
  return settle(applied(layout, command));
}

/** A layout written by hand: a list of panel ids is a window. */
export type WindowLayoutSpec =
  | readonly string[]
  | {
      readonly direction: WindowSplitDirection;
      readonly children: readonly WindowLayoutSpec[];
      readonly sizes?: readonly number[] | undefined;
    };

function isTabs(spec: WindowLayoutSpec): spec is readonly string[] {
  return Array.isArray(spec);
}

/**
 * Builds a layout from a nested description, numbering windows (`w1`, `w2`)
 * and splits (`s1`) in reading order. A panel named twice keeps its first
 * place; an empty window is dropped.
 */
export function createWindowLayout(spec: WindowLayoutSpec): WindowLayout {
  const seen = new Set<string>();
  const counters = { w: 0, s: 0 };
  const build = (item: WindowLayoutSpec): WindowNode | null => {
    if (isTabs(item)) {
      const tabs = item.filter((tab) => {
        const fresh = !seen.has(tab);
        seen.add(tab);
        return fresh;
      });
      const active = tabs[0];
      if (active === undefined) return null;
      counters.w += 1;
      return { type: 'window', id: `w${String(counters.w)}`, tabs, active };
    }
    counters.s += 1;
    const id = `s${String(counters.s)}`;
    const children = item.children.map(build);
    const sizes = children.map((_, index) => {
      const size = item.sizes?.[index];
      return size !== undefined && Number.isFinite(size) && size > 0 ? size : 1;
    });
    const kept = children.flatMap((child, index) =>
      child === null ? [] : [[child, sizes[index] ?? 1] as const]
    );
    return rebuild(
      {
        type: 'split',
        id,
        direction: item.direction,
        children: kept.map(([child]) => child),
        sizes: kept.map(([, size]) => size),
      },
      (group) => group
    );
  };
  return settle({ root: build(spec), focused: null, maximized: null });
}

/** The layout without the panels `known` does not name. */
export function pruneWindowLayout(
  layout: WindowLayout,
  known: readonly string[]
): WindowLayout {
  const stale = windowPanels(layout).filter((panel) => !known.includes(panel));
  if (stale.length === 0) return layout;
  return stale.reduce<WindowLayout>(
    (next, panel) => applyWindowLayoutCommand(next, { type: 'close', panel }),
    layout
  );
}
