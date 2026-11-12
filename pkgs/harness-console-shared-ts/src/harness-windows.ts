/**
 * The harness console's panels: one per node of the running system, of which
 * the console shows one at a time.
 *
 * Pure data, so the console, its address codec and the acceptance steps all
 * choose among the same panels the same way.
 */

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

/** The id of the view that shows an emulator's dashboard. */
export function harnessEmulatorPanelId(emulator: string): string {
  return `emulator:${emulator}`;
}

function isClient(panel: string): boolean {
  // By its own prefix: an id of no known kind is not a client's.
  return parseHarnessNodeAddress(panel).kind === 'client';
}

/**
 * The panel on show for the panels that exist now: `wanted` when it is one of
 * them, and otherwise the first client's (a missing choice falls back to a
 * device that is there), or the first panel of a system with no client.
 */
export function resolveHarnessView(
  wanted: string | null,
  panels: readonly string[]
): string | null {
  if (wanted !== null && panels.includes(wanted)) return wanted;
  return panels.find(isClient) ?? panels[0] ?? null;
}

/**
 * The client after the one on show, around to the first again. From a panel
 * that is not a client's it is the first client: the way back to the apps.
 */
export function nextHarnessClient(
  shown: string | null,
  panels: readonly string[]
): string | null {
  const clients = panels.filter(isClient);
  const at = shown === null ? -1 : clients.indexOf(shown);
  return clients[(at + 1) % Math.max(clients.length, 1)] ?? null;
}

/** The client node whose app is on show, when a client's is. */
export function shownHarnessClient(view: string | null): string | null {
  if (view === null || !isClient(view)) return null;
  return parseHarnessNodeAddress(view).instanceId;
}
