/**
 * Pure harness navigation codec (no wall I/O).
 *
 * URL search keys:
 * - harness: kind, instance, cv (id:view,…); legacy trailing `:table` ignored
 *
 * Defaults are omitted from the built search. Legacy `host=console` is
 * ignored. Legacy top-level `view` applies to the focused instance (or the
 * kind key for server/events). View aliases: html→ui, sqlite→db, logs→events.
 */

import type { DebuggerViewId } from '@pkgs/harness-console-shared/debugger-views';
import {
  defaultViewForKind,
  VIEWS_BY_KIND,
} from '@pkgs/harness-console-shared/debugger-views';
import type { HarnessChromeKind } from '@pkgs/harness-console-shared/node';
import { coerceHarnessChromeKind } from '@pkgs/harness-console-shared/node';

export type ConsoleKind = HarnessChromeKind;
export type ConsoleView = DebuggerViewId;

export type PaneNav = {
  readonly view: ConsoleView;
};

export type HarnessNav = {
  readonly kind: ConsoleKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNav>>;
};

export type ConsoleNavState = {
  readonly harness: HarnessNav;
};

export type PaneNavPatch = {
  readonly view?: string;
};

export type HarnessNavPatch = {
  readonly kind?: ConsoleKind;
  readonly instance?: string;
  readonly panes?: Readonly<Record<string, PaneNavPatch>>;
  /** Patch a single pane by id (merged into current panes). */
  readonly pane?: { readonly id: string; readonly patch: PaneNavPatch };
};

export type ConsoleNavPatch = {
  readonly harness?: HarnessNavPatch;
  /**
   * Flat legacy patches — applied onto `harness`.
   */
  readonly kind?: ConsoleKind;
  readonly instance?: string;
  readonly view?: string;
};

export const DEFAULT_HARNESS_NAV: HarnessNav = {
  kind: 'client',
  instance: '',
  panes: {},
};

export const DEFAULT_CONSOLE_NAV: ConsoleNavState = {
  harness: DEFAULT_HARNESS_NAV,
};

/** Legacy section / report-tab keys are dropped on rewrite. */
const CHROME_KEYS = [
  'host',
  'section',
  'kind',
  'view',
  'instance',
  'cv',
  'bucket',
  'run',
  'test',
  'frame',
  'node',
  'rview',
] as const;

const VIEW_ALIASES: Readonly<Record<string, ConsoleView>> = {
  html: 'ui',
  sqlite: 'db',
  logs: 'events',
};

const ALL_VIEWS = new Set<string>(['ui', 'db', 'events', 'commands', 'topics']);

export function coerceView(kind: ConsoleKind, view: string): ConsoleView {
  const aliased = VIEW_ALIASES[view] ?? view;
  const allowed = viewsAllowedForKind(kind);
  if (ALL_VIEWS.has(aliased) && allowed.includes(aliased as ConsoleView)) {
    return aliased as ConsoleView;
  }
  return defaultViewForKind(kind);
}

export function coerceKind(kindRaw: string | null | undefined): ConsoleKind {
  return coerceHarnessChromeKind(kindRaw);
}

/** Stable pane key for singleton kinds (server / events). */
export function singletonPaneKey(kind: ConsoleKind): string | null {
  if (kind === 'server' || kind === 'events') return kind;
  return null;
}

export function resolvePaneNav(
  harness: HarnessNav,
  paneId: string,
  kind: ConsoleKind = harness.kind
): PaneNav {
  const direct = harness.panes[paneId];
  if (direct !== undefined) return coercePaneForKind(kind, direct);
  const singleton = singletonPaneKey(kind);
  if (singleton !== null && singleton !== paneId) {
    const byKind = harness.panes[singleton];
    if (byKind !== undefined) return coercePaneForKind(kind, byKind);
  }
  return { view: defaultViewForKind(kind) };
}

export function applyConsoleNavPatch(
  current: ConsoleNavState,
  patch: ConsoleNavPatch
): ConsoleNavState {
  const harnessPatch: HarnessNavPatch = {
    ...(patch.harness ?? {}),
    ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
    ...(patch.instance !== undefined ? { instance: patch.instance } : {}),
    ...(patch.view !== undefined
      ? {
          pane: {
            id: focusedPaneId(
              patch.kind ?? patch.harness?.kind ?? current.harness.kind,
              patch.instance !== undefined
                ? patch.instance
                : (patch.harness?.instance ?? current.harness.instance)
            ),
            patch: { view: patch.view },
          },
        }
      : {}),
  };
  return {
    harness: applyHarnessNavPatch(current.harness, harnessPatch),
  };
}

export function parseConsoleNav(search: string): ConsoleNavState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const kind = coerceKind(params.get('kind'));
  const instanceParam = params.get('instance')?.trim() ?? '';
  const panes = parsePaneMap(params.get('cv'), kind);
  const legacyView = params.get('view');
  let instance = normalizeInstance(kind, instanceParam);
  if (instance.length === 0) {
    const firstId = Object.keys(panes)[0];
    if (firstId !== undefined && singletonPaneKey(kind) === null) {
      instance = firstId;
    }
  }
  const focusedId = focusedPaneId(kind, instance);
  if (
    legacyView !== null &&
    legacyView.length > 0 &&
    panes[focusedId] === undefined
  ) {
    const view = coerceView(kind, legacyView);
    if (view !== defaultViewForKind(kind)) {
      panes[focusedId] = { view };
    }
  }
  return {
    harness: {
      kind,
      instance,
      panes,
    },
  };
}

/**
 * Build a search string from chrome state, preserving non-chrome query keys
 * from `existingSearch`.
 */
export function buildConsoleSearch(
  state: ConsoleNavState,
  existingSearch = ''
): string {
  const params = new URLSearchParams(
    existingSearch.startsWith('?') ? existingSearch.slice(1) : existingSearch
  );
  for (const key of CHROME_KEYS) params.delete(key);

  const { harness } = state;
  if (harness.kind !== 'client') params.set('kind', harness.kind);
  if (harness.instance.length > 0) {
    params.set('instance', harness.instance);
  }
  const cv = buildPaneMap(harness);
  if (cv.length > 0) params.set('cv', cv);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function consoleNavEqual(
  a: ConsoleNavState,
  b: ConsoleNavState
): boolean {
  return harnessEqual(a.harness, b.harness);
}

function harnessEqual(a: HarnessNav, b: HarnessNav): boolean {
  if (a.kind !== b.kind || a.instance !== b.instance) return false;
  const aKeys = Object.keys(a.panes).sort();
  const bKeys = Object.keys(b.panes).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i++) {
    const key = aKeys[i]!;
    if (key !== bKeys[i]) return false;
    const ap = a.panes[key]!;
    const bp = b.panes[key]!;
    if (ap.view !== bp.view) return false;
  }
  return true;
}

function applyHarnessNavPatch(
  current: HarnessNav,
  patch: HarnessNavPatch
): HarnessNav {
  const kind = patch.kind ?? current.kind;
  const instanceRaw =
    patch.instance !== undefined ? patch.instance : current.instance;
  const panes: Record<string, PaneNav> = { ...current.panes };
  if (patch.panes !== undefined) {
    for (const [id, panePatch] of Object.entries(patch.panes)) {
      panes[id] = mergePane(kind, panes[id], panePatch);
    }
  }
  if (patch.pane !== undefined) {
    const { id, patch: panePatch } = patch.pane;
    panes[id] = mergePane(kind, panes[id], panePatch);
  }
  return {
    kind,
    instance: normalizeInstance(kind, instanceRaw),
    panes,
  };
}

function mergePane(
  kind: ConsoleKind,
  current: PaneNav | undefined,
  patch: PaneNavPatch
): PaneNav {
  const base = current ?? { view: defaultViewForKind(kind) };
  const view =
    patch.view !== undefined ? coerceView(kind, patch.view) : base.view;
  return { view };
}

function coercePaneForKind(kind: ConsoleKind, pane: PaneNav): PaneNav {
  return { view: coerceView(kind, pane.view) };
}

function focusedPaneId(kind: ConsoleKind, instance: string): string {
  const singleton = singletonPaneKey(kind);
  if (singleton !== null) return singleton;
  return instance.trim();
}

function normalizeInstance(kind: ConsoleKind, raw: string): string {
  if (kind === 'server' || kind === 'events') return '';
  return raw.trim();
}

function viewsAllowedForKind(kind: ConsoleKind): readonly ConsoleView[] {
  return VIEWS_BY_KIND[kind];
}

function impliedPaneKind(paneId: string, chromeKind: ConsoleKind): ConsoleKind {
  if (paneId === 'server' || paneId === 'events') return paneId;
  return chromeKind === 'room' ? 'room' : 'client';
}

function parsePaneMap(
  raw: string | null,
  kind: ConsoleKind
): Record<string, PaneNav> {
  const out: Record<string, PaneNav> = {};
  if (raw === null || raw.trim() === '') return out;
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const segments = trimmed.split(':');
    if (segments.length < 2) continue;
    const id = decodeURIComponent(segments[0] ?? '').trim();
    const viewRaw = decodeURIComponent(segments[1] ?? '').trim();
    // Legacy `id:view:table` — discard trailing table segment.
    if (id.length === 0 || viewRaw.length === 0) continue;
    const view = coerceLooseView(viewRaw, kind, id);
    // Symmetric with buildPaneMap: drop entries whose coerced view equals
    // the node's implied-kind default (e.g. legacy client db/events panes).
    if (view === defaultViewForKind(impliedPaneKind(id, kind))) continue;
    out[id] = { view };
  }
  return out;
}

/**
 * Per-node views may belong to a different kind than the current chrome kind
 * (e.g. alice:db while kind=server briefly). Prefer a legal view for the
 * node’s implied kind when id matches a singleton key.
 */
function coerceLooseView(
  viewRaw: string,
  chromeKind: ConsoleKind,
  paneId: string
): ConsoleView {
  // Client panes no longer carry db/events tabs: a non-singleton node's
  // implied kind is `client` (unless the chrome kind is room), so coerce
  // within that kind's legal views instead of any view id.
  return coerceView(impliedPaneKind(paneId, chromeKind), viewRaw);
}

function buildPaneMap(harness: HarnessNav): string {
  const entries: string[] = [];
  const keys = Object.keys(harness.panes).sort();
  for (const id of keys) {
    const pane = harness.panes[id]!;
    // Mirror parse coercion: a pane whose view equals its implied-kind
    // default is dropped on parse, so omit it here too.
    if (pane.view === defaultViewForKind(impliedPaneKind(id, harness.kind)))
      continue;
    entries.push(`${encodeURIComponent(id)}:${encodeURIComponent(pane.view)}`);
  }
  return entries.join(',');
}
