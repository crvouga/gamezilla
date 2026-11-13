/**
 * The harness console's views: a panel per node of the running system and the
 * harness's own app, of which the console shows one at a time.
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
 * The harness's own app: where the world is set up, and where every view
 * behind the apps is opened from.
 */
export const HARNESS_APP_VIEW = 'harness';

/**
 * The apps the switcher goes through, in its order: each client's, then the
 * harness's own. A node behind the apps or an emulator's dashboard is a view
 * the harness app opens, not an app.
 */
export function harnessApps(views: readonly string[]): readonly string[] {
  return [
    ...views.filter(isClient),
    ...views.filter((view) => view === HARNESS_APP_VIEW),
  ];
}

/**
 * The app `step` on from the one on show, around again. From a view that is
 * not an app it is the harness app, which opened it; with no harness app,
 * the first client's.
 */
export function steppedHarnessApp(
  shown: string | null,
  views: readonly string[],
  step: 1 | -1
): string | null {
  const apps = harnessApps(views);
  const at = shown === null ? -1 : apps.indexOf(shown);
  if (at === -1)
    return apps.find((app) => app === HARNESS_APP_VIEW) ?? apps[0] ?? null;
  return apps[(at + step + apps.length) % apps.length] ?? null;
}

/** What a key press asks the switcher for. */
export type HarnessSwitch =
  | { readonly to: 'next' }
  | { readonly to: 'previous' }
  | { readonly to: 'harness' }
  /** The app at this place in the switcher's order, from 0. */
  | { readonly to: 'app'; readonly at: number };

/** The keys that switch, as shortcut specs, for showing beside what they do. */
export const HARNESS_SWITCH_KEYS = {
  next: 'alt+]',
  previous: 'alt+[',
  app: 'alt+1',
  harness: 'alt+0',
} as const;

const DIGIT = /^Digit([0-9])$/;

/**
 * The switch a key press asks for, or `null`: Alt with `]` and `[` for the
 * next and the previous app, Alt with 1 to 9 for an app by its place, Alt
 * with 0 for the harness app. Read from the key's place on the keyboard
 * (`code`), since Alt changes the character it types; with Alt alone, so no
 * shortcut of the app on show or of the browser is taken.
 */
export function harnessSwitchOf(event: {
  readonly code?: string | undefined;
  readonly altKey: boolean;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly shiftKey: boolean;
}): HarnessSwitch | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
    return null;
  if (event.code === 'BracketRight') return { to: 'next' };
  if (event.code === 'BracketLeft') return { to: 'previous' };
  const digit = DIGIT.exec(event.code ?? '')?.[1];
  if (digit === undefined) return null;
  return digit === '0'
    ? { to: 'harness' }
    : { to: 'app', at: Number(digit) - 1 };
}

/** The view a switch goes to, or `null` when there is none to go to. */
export function harnessSwitchTarget(
  asked: HarnessSwitch,
  shown: string | null,
  views: readonly string[]
): string | null {
  if (asked.to === 'next') return steppedHarnessApp(shown, views, 1);
  if (asked.to === 'previous') return steppedHarnessApp(shown, views, -1);
  const apps = harnessApps(views);
  if (asked.to === 'harness')
    return apps.find((app) => app === HARNESS_APP_VIEW) ?? null;
  return apps[asked.at] ?? null;
}

/** The client node whose app is on show, when a client's is. */
export function shownHarnessClient(view: string | null): string | null {
  if (view === null || !isClient(view)) return null;
  return parseHarnessNodeAddress(view).instanceId;
}
