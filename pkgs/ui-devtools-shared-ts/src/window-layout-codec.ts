/**
 * A window layout as one short string, for a URL, a saved preference or a
 * script. Window and split ids are not part of it: a parsed layout numbers
 * them in reading order, so the same string always gives the same ids.
 *
 * The text is JSON. A window is `{"t":[panel ids],"a":active index}`, a split
 * is `{"d":"r"|"c","c":[children],"s":[weights]}`, and the layout is
 * `{"r":root,"f":focused panel,"m":true when maximized}`.
 */

import {
  applyWindowLayoutCommand,
  createWindowLayout,
  type WindowLayout,
  type WindowLayoutSpec,
  type WindowNode,
  windowById,
} from './window-layout';

type PackedWindow = { readonly t: readonly string[]; readonly a?: number };
type PackedSplit = {
  readonly d: 'r' | 'c';
  readonly c: readonly PackedNode[];
  readonly s?: readonly number[];
};
type PackedNode = PackedWindow | PackedSplit;

const MAX_DEPTH = 32;

function weight(size: number): number {
  return Math.max(0.0001, Math.round(size * 10_000) / 10_000);
}

function pack(node: WindowNode): PackedNode {
  if (node.type === 'window') {
    const active = node.tabs.indexOf(node.active);
    return active > 0 ? { t: node.tabs, a: active } : { t: node.tabs };
  }
  const sizes = node.sizes.map(weight);
  const even = sizes.every((size) => size === sizes[0]);
  return {
    d: node.direction === 'row' ? 'r' : 'c',
    c: node.children.map(pack),
    ...(even ? {} : { s: sizes }),
  };
}

export function serializeWindowLayout(layout: WindowLayout): string {
  const focused = windowById(layout, layout.focused);
  return JSON.stringify({
    r: layout.root === null ? null : pack(layout.root),
    ...(focused === null ? {} : { f: focused.active }),
    ...(layout.maximized === null ? {} : { m: true }),
  });
}

function record(value: unknown): Readonly<Record<string, unknown>> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : null;
}

function strings(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
    ? value
    : null;
}

type Unpacked = {
  readonly spec: WindowLayoutSpec;
  /** The visible panel of each window that is not its first tab. */
  readonly active: readonly string[];
};

function unpackSplit(
  node: Readonly<Record<string, unknown>>,
  depth: number
): Unpacked | null {
  const direction = node['d'];
  const children = node['c'];
  if ((direction !== 'r' && direction !== 'c') || !Array.isArray(children))
    return null;
  const parts = children.map((child) => unpack(child, depth + 1));
  const sizes = Array.isArray(node['s']) ? node['s'] : [];
  if (parts.includes(null)) return null;
  const kept = parts.flatMap((part) => (part === null ? [] : [part]));
  return {
    spec: {
      direction: direction === 'r' ? 'row' : 'column',
      children: kept.map((part) => part.spec),
      sizes: kept.map((_, index) => {
        const size: unknown = sizes[index];
        return typeof size === 'number' ? size : 1;
      }),
    },
    active: kept.flatMap((part) => part.active),
  };
}

function unpack(value: unknown, depth: number): Unpacked | null {
  const node = record(value);
  if (node === null || depth > MAX_DEPTH) return null;
  const tabs = strings(node['t']);
  if (tabs === null) return unpackSplit(node, depth);
  const at = node['a'];
  const active = typeof at === 'number' ? tabs[at] : undefined;
  return { spec: tabs, active: active === undefined ? [] : [active] };
}

/** The layout `text` describes, or `null` when it is not a layout. */
export function parseWindowLayout(text: string): WindowLayout | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const top = record(parsed);
  if (top === null) return null;
  if (top['r'] === null) return createWindowLayout([]);
  const root = unpack(top['r'], 0);
  if (root === null) return null;
  const focused = top['f'];
  const shown = [
    ...root.active,
    ...(typeof focused === 'string' ? [focused] : []),
  ];
  const layout = shown.reduce<WindowLayout>(
    (next, panel) => applyWindowLayoutCommand(next, { type: 'select', panel }),
    createWindowLayout(root.spec)
  );
  return top['m'] === true && layout.focused !== null
    ? applyWindowLayoutCommand(layout, {
        type: 'maximize',
        window: layout.focused,
      })
    : layout;
}
