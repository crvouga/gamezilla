/**
 * The harness console as windows: one panel per node of the running system,
 * and the window layouts the console starts from.
 *
 * Pure data, so the console, its address codec and the acceptance steps all
 * arrange the same panels the same way.
 */

import {
  applyWindowLayoutCommand,
  createWindowLayout,
  pruneWindowLayout,
  type WindowGroup,
  type WindowLayout,
  windowById,
  windowGroups,
  windowOfPanel,
} from '@pkgs/ui-devtools-shared-ts/window-layout';
import { parseWindowLayout } from '@pkgs/ui-devtools-shared-ts/window-layout-codec';
import {
  coerceHarnessChromeKind,
  formatHarnessNodeLabel,
  type HarnessChromeKind,
  parseHarnessNodeAddress,
} from './node';

/** The node ids of a running system; the balancer and pub/sub always exist. */
export type HarnessTopology = {
  readonly clients: readonly string[];
  readonly servers: readonly string[];
  readonly rooms: readonly string[];
};

export type HarnessPanelRef = {
  /** Panel id: `client:<id>`, `lb`, `server:<id>`, `events` or `room:<id>`. */
  readonly id: string;
  readonly kind: HarnessChromeKind;
  /** The node the panel looks into; `null` for the balancer and pub/sub. */
  readonly node: string | null;
  readonly title: string;
};

export const HARNESS_BALANCER_PANEL = 'lb';
export const HARNESS_PUBSUB_PANEL = 'events';

export function harnessPanelId(
  kind: 'client' | 'server' | 'room',
  node: string
): string {
  return `${kind}:${node}`;
}

export function harnessPanelKind(panel: string): HarnessChromeKind {
  return coerceHarnessChromeKind(parseHarnessNodeAddress(panel).kind);
}

function ref(kind: HarnessChromeKind, node: string | null): HarnessPanelRef {
  const id =
    node === null || kind === 'lb' || kind === 'events'
      ? kind
      : harnessPanelId(kind, node);
  return { id, kind, node, title: formatHarnessNodeLabel({ id, kind }) };
}

/**
 * Every panel of a system, along the request path: clients, the balancer,
 * each API instance, pub/sub, then the live rooms.
 */
export function harnessPanels(
  topology: HarnessTopology
): readonly HarnessPanelRef[] {
  return [
    ...topology.clients.map((id) => ref('client', id)),
    ref('lb', null),
    ...topology.servers.map((id) => ref('server', id)),
    ref('events', null),
    ...topology.rooms.map((id) => ref('room', id)),
  ];
}

/** `beside`: a window per client. `tabs`: the clients share one window. */
export type HarnessArrangement = 'beside' | 'tabs';

function isClient(panel: string): boolean {
  return harnessPanelKind(panel) === 'client';
}

function shown(layout: WindowLayout, panels: readonly string[]): WindowLayout {
  return panels.reduce<WindowLayout>(
    (next, panel) => applyWindowLayoutCommand(next, { type: 'select', panel }),
    layout
  );
}

/**
 * The clients in a row (or in one tabbed window), then one window that tabs
 * the rest of the system. With `current`, the panels it shows stay on show
 * and its focused panel stays focused.
 */
export function arrangeHarnessLayout(
  panels: readonly string[],
  arrangement: HarnessArrangement,
  current: WindowLayout | null = null
): WindowLayout {
  const clients = panels.filter(isClient);
  const rest = panels.filter((panel) => !isClient(panel));
  const layout = createWindowLayout({
    direction: 'row',
    children: [
      ...(arrangement === 'beside' ? clients.map((id) => [id]) : [clients]),
      rest,
    ],
  });
  if (current === null) return layout;
  const focused = windowById(current, current.focused)?.active;
  return shown(layout, [
    ...windowGroups(current).map((group) => group.active),
    ...(focused === undefined ? [] : [focused]),
  ]);
}

/**
 * The layout a stored `text` describes for the panels that exist now: panels
 * that are gone are dropped, and text that is missing, unreadable or left
 * with nothing to show gives the starting arrangement.
 */
export function resolveHarnessLayout(
  text: string | null,
  panels: readonly string[]
): WindowLayout {
  const parsed = text === null ? null : parseWindowLayout(text);
  if (parsed === null) return arrangeHarnessLayout(panels, 'beside');
  const pruned = pruneWindowLayout(parsed, panels);
  return pruned.root === null && parsed.root !== null
    ? arrangeHarnessLayout(panels, 'beside')
    : pruned;
}

function lastWhere(
  layout: WindowLayout,
  test: (group: WindowGroup) => boolean
): WindowGroup | undefined {
  return windowGroups(layout).filter(test).at(-1);
}

function admit(layout: WindowLayout, panel: string): WindowLayout {
  if (windowOfPanel(layout, panel) !== null) return layout;
  const client = isClient(panel);
  const family = (group: WindowGroup): boolean =>
    group.tabs.some((tab) => isClient(tab) === client);
  const shared = lastWhere(
    layout,
    (group) => family(group) && (!client || group.tabs.length > 1)
  );
  if (shared !== undefined)
    return applyWindowLayoutCommand(layout, {
      type: 'move',
      panel,
      window: shared.id,
    });
  const beside = lastWhere(layout, family);
  return applyWindowLayoutCommand(
    layout,
    beside === undefined
      ? { type: 'open', panel }
      : { type: 'split', panel, window: beside.id, edge: 'right' }
  );
}

/**
 * The layout with panels for nodes that just appeared: a client joins the
 * window that tabs clients, or gets a window beside the last client; any
 * other node joins the window that holds the rest of the system. What was on
 * show and focused stays so.
 */
export function admitHarnessPanels(
  layout: WindowLayout,
  panels: readonly string[]
): WindowLayout {
  const focused = windowById(layout, layout.focused)?.active;
  const before = windowGroups(layout).map((group) => group.active);
  const next = panels.reduce(admit, layout);
  if (next === layout) return layout;
  return shown(next, [...before, ...(focused === undefined ? [] : [focused])]);
}

/** The client nodes whose app is on show, in reading order. */
export function shownHarnessClients(layout: WindowLayout): readonly string[] {
  const maximized = windowById(layout, layout.maximized);
  const groups = maximized === null ? windowGroups(layout) : [maximized];
  return groups.flatMap((group) => {
    const { instanceId } = parseHarnessNodeAddress(group.active);
    return isClient(group.active) && instanceId !== null ? [instanceId] : [];
  });
}
