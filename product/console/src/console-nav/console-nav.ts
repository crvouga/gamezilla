/**
 * Pure console navigation codec (no wall I/O).
 *
 * URL search keys:
 * - section
 * - playground: kind, instance, cv (id:view,…); legacy trailing `:table` ignored
 * - reports: bucket, run, test, frame, node, rview
 *
 * Defaults are omitted from the built search. Legacy `host=console` is
 * ignored. Legacy top-level `view` applies to the focused instance (or the
 * kind key for server/events). View aliases: html→ui, sqlite→db, logs→events.
 */

import {
  DEFAULT_NAV as DEFAULT_REPORT_NAV,
  navigateReport,
  type NavPatch as ReportNavPatch,
  type ReportNavState,
} from '@pkgs/sim-console/client/router';
import {
  type DebuggerViewId,
  defaultViewForKind,
} from '@pkgs/sim-console/shared/debugger-views';
import {
  coerceSimChromeKind,
  type SimChromeKind,
} from '@pkgs/sim-console/shared/sim-node';

export type ConsoleSection = 'reports' | 'playground';
export type ConsoleKind = SimChromeKind;
export type ConsoleView = DebuggerViewId;

export type PaneNav = {
  readonly view: ConsoleView;
};

export type PlaygroundNav = {
  readonly kind: ConsoleKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNav>>;
};

export type ConsoleNavState = {
  readonly section: ConsoleSection;
  readonly playground: PlaygroundNav;
  readonly reports: ReportNavState;
};

export type PaneNavPatch = {
  readonly view?: string;
};

export type PlaygroundNavPatch = {
  readonly kind?: ConsoleKind;
  readonly instance?: string;
  readonly panes?: Readonly<Record<string, PaneNavPatch>>;
  /** Patch a single pane by id (merged into current panes). */
  readonly pane?: { readonly id: string; readonly patch: PaneNavPatch };
};

export type ConsoleNavPatch = {
  readonly section?: ConsoleSection;
  readonly playground?: PlaygroundNavPatch;
  readonly reports?: ReportNavPatch;
  /**
   * Flat legacy patches — applied onto `playground` so older callers still
   * work during the transition.
   */
  readonly kind?: ConsoleKind;
  readonly instance?: string;
  readonly view?: string;
};

export const DEFAULT_PLAYGROUND_NAV: PlaygroundNav = {
  kind: 'client',
  instance: '',
  panes: {},
};

export const DEFAULT_CONSOLE_NAV: ConsoleNavState = {
  section: 'reports',
  playground: DEFAULT_PLAYGROUND_NAV,
  reports: DEFAULT_REPORT_NAV,
};

const SECTIONS = new Set<string>(['reports', 'playground']);

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

export type { ReportNavPatch, ReportNavState };
export { defaultViewForKind };

export function coerceView(kind: ConsoleKind, view: string): ConsoleView {
  const aliased = VIEW_ALIASES[view] ?? view;
  const allowed = viewsAllowedForKind(kind);
  if (ALL_VIEWS.has(aliased) && allowed.includes(aliased as ConsoleView)) {
    return aliased as ConsoleView;
  }
  return defaultViewForKind(kind);
}

export function coerceKind(kindRaw: string | null | undefined): ConsoleKind {
  return coerceSimChromeKind(kindRaw);
}

/** Stable pane key for singleton kinds (server / events). */
export function singletonPaneKey(kind: ConsoleKind): string | null {
  if (kind === 'server' || kind === 'events') return kind;
  return null;
}

export function resolvePaneNav(
  playground: PlaygroundNav,
  paneId: string,
  kind: ConsoleKind = playground.kind
): PaneNav {
  const direct = playground.panes[paneId];
  if (direct !== undefined) return coercePaneForKind(kind, direct);
  const singleton = singletonPaneKey(kind);
  if (singleton !== null && singleton !== paneId) {
    const byKind = playground.panes[singleton];
    if (byKind !== undefined) return coercePaneForKind(kind, byKind);
  }
  return { view: defaultViewForKind(kind) };
}

export function applyConsoleNavPatch(
  current: ConsoleNavState,
  patch: ConsoleNavPatch
): ConsoleNavState {
  const playgroundPatch: PlaygroundNavPatch = {
    ...(patch.playground ?? {}),
    ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
    ...(patch.instance !== undefined ? { instance: patch.instance } : {}),
    ...(patch.view !== undefined
      ? {
          pane: {
            id: focusedPaneId(
              patch.kind ?? patch.playground?.kind ?? current.playground.kind,
              patch.instance !== undefined
                ? patch.instance
                : (patch.playground?.instance ?? current.playground.instance)
            ),
            patch: { view: patch.view },
          },
        }
      : {}),
  };
  return {
    section: patch.section ?? current.section,
    playground: applyPlaygroundPatch(current.playground, playgroundPatch),
    reports:
      patch.reports !== undefined
        ? navigateReport(current.reports, patch.reports)
        : current.reports,
  };
}

export function parseConsoleNav(search: string): ConsoleNavState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const section = parseSection(params.get('section'));
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
    section,
    playground: {
      kind,
      instance,
      panes,
    },
    reports: parseReportsFromParams(params),
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

  if (state.section !== 'reports') params.set('section', state.section);

  const { playground, reports } = state;
  if (playground.kind !== 'client') params.set('kind', playground.kind);
  if (playground.instance.length > 0) {
    params.set('instance', playground.instance);
  }
  const cv = buildPaneMap(playground);
  if (cv.length > 0) params.set('cv', cv);

  writeReportsParams(params, reports);

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function consoleNavEqual(
  a: ConsoleNavState,
  b: ConsoleNavState
): boolean {
  return (
    a.section === b.section &&
    playgroundEqual(a.playground, b.playground) &&
    reportsEqual(a.reports, b.reports)
  );
}

function playgroundEqual(a: PlaygroundNav, b: PlaygroundNav): boolean {
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

function reportsEqual(a: ReportNavState, b: ReportNavState): boolean {
  return (
    a.bucketId === b.bucketId &&
    a.runId === b.runId &&
    a.testId === b.testId &&
    a.frame === b.frame &&
    a.node === b.node &&
    a.view === b.view
  );
}

function applyPlaygroundPatch(
  current: PlaygroundNav,
  patch: PlaygroundNavPatch
): PlaygroundNav {
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

function parseSection(raw: string | null): ConsoleSection {
  return raw !== null && SECTIONS.has(raw)
    ? (raw as ConsoleSection)
    : 'reports';
}

function normalizeInstance(kind: ConsoleKind, raw: string): string {
  if (kind === 'server' || kind === 'events') return '';
  return raw.trim();
}

function viewsAllowedForKind(kind: ConsoleKind): readonly ConsoleView[] {
  switch (kind) {
    case 'client':
      return ['ui', 'db', 'events'];
    case 'server':
      return ['db', 'events', 'commands'];
    case 'events':
      return ['events', 'topics'];
    case 'room':
      return ['db', 'events'];
  }
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
    out[id] = {
      view: coerceLooseView(viewRaw, kind, id),
    };
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
  if (paneId === 'server') return coerceView('server', viewRaw);
  if (paneId === 'events') return coerceView('events', viewRaw);
  const aliased = VIEW_ALIASES[viewRaw] ?? viewRaw;
  if (ALL_VIEWS.has(aliased)) return aliased as ConsoleView;
  return coerceView(chromeKind, viewRaw);
}

function buildPaneMap(playground: PlaygroundNav): string {
  const entries: string[] = [];
  const keys = Object.keys(playground.panes).sort();
  for (const id of keys) {
    const pane = playground.panes[id]!;
    const defaultView =
      id === 'server'
        ? defaultViewForKind('server')
        : id === 'events'
          ? defaultViewForKind('events')
          : defaultViewForKind(playground.kind === 'room' ? 'room' : 'client');
    if (pane.view === defaultView) continue;
    entries.push(`${encodeURIComponent(id)}:${encodeURIComponent(pane.view)}`);
  }
  return entries.join(',');
}

function parseReportsFromParams(params: URLSearchParams): ReportNavState {
  const bucketId = emptyToNull(params.get('bucket'));
  const runId = emptyToNull(params.get('run'));
  const testId = emptyToNull(params.get('test'));
  const node = emptyToNull(params.get('node'));
  const frame = parsePositiveInt(params.get('frame'));
  const rview = params.get('rview');
  return {
    bucketId,
    runId,
    testId,
    frame,
    node,
    view: parseReportView(rview),
  };
}

function writeReportsParams(
  params: URLSearchParams,
  reports: ReportNavState
): void {
  if (reports.bucketId != null) params.set('bucket', reports.bucketId);
  if (reports.runId != null) params.set('run', reports.runId);
  if (reports.testId != null) params.set('test', reports.testId);
  if (reports.frame != null) params.set('frame', String(reports.frame));
  if (reports.node != null) params.set('node', reports.node);
  if (reports.view != null) params.set('rview', reports.view);
}

function emptyToNull(raw: string | null): string | null {
  if (raw == null || raw.trim() === '') return null;
  return raw.trim();
}

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

function parseReportView(raw: string | null): ReportNavState['view'] {
  if (raw == null || raw === '') return null;
  const aliased = VIEW_ALIASES[raw] ?? raw;
  return ALL_VIEWS.has(aliased)
    ? (aliased as NonNullable<ReportNavState['view']>)
    : null;
}
