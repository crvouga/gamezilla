/**
 * Pure console navigation codec (no wall I/O).
 *
 * URL search keys: section, kind, instance, view. Defaults are omitted from
 * the built search. Legacy `host=console` is ignored. Legacy `cv=alice:db`
 * becomes `instance=alice` (and `view=db` when needed). View aliases:
 * html→ui, sqlite→db, logs→events.
 */

import {
  coerceDebuggerView,
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

export type ConsoleNavState = {
  readonly section: ConsoleSection;
  readonly kind: ConsoleKind;
  readonly instance: string;
  readonly view: ConsoleView;
};

export type ConsoleNavPatch = {
  readonly section?: ConsoleSection;
  readonly kind?: ConsoleKind;
  readonly instance?: string;
  readonly view?: string;
};

export const DEFAULT_CONSOLE_NAV: ConsoleNavState = {
  section: 'reports',
  kind: 'client',
  instance: '',
  view: 'ui',
};

const SECTIONS = new Set<string>(['reports', 'playground']);

const CHROME_KEYS = [
  'host',
  'section',
  'kind',
  'view',
  'instance',
  'cv',
] as const;

export { defaultViewForKind };

export function coerceView(kind: ConsoleKind, view: string): ConsoleView {
  return coerceDebuggerView(kind, view);
}

export function coerceKind(kindRaw: string | null | undefined): ConsoleKind {
  return coerceSimChromeKind(kindRaw);
}

export function applyConsoleNavPatch(
  current: ConsoleNavState,
  patch: ConsoleNavPatch
): ConsoleNavState {
  const kind = patch.kind ?? current.kind;
  const viewRaw = patch.view ?? current.view;
  const instanceRaw =
    patch.instance !== undefined ? patch.instance : current.instance;
  return {
    section: patch.section ?? current.section,
    kind,
    instance: normalizeInstance(kind, instanceRaw),
    view: coerceView(kind, viewRaw),
  };
}

export function parseConsoleNav(search: string): ConsoleNavState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const section = parseSection(params.get('section'));
  const kind = coerceKind(params.get('kind'));
  const instanceParam = params.get('instance')?.trim() ?? '';
  const legacy =
    instanceParam.length === 0 ? parseLegacyClientView(params.get('cv')) : null;
  const instance = normalizeInstance(kind, instanceParam || legacy?.id || '');
  const viewRaw =
    params.get('view') ?? legacy?.view ?? defaultViewForKind(kind);
  return {
    section,
    kind,
    instance,
    view: coerceView(kind, viewRaw),
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
  if (state.kind !== 'client') params.set('kind', state.kind);
  if (state.instance.length > 0) params.set('instance', state.instance);
  if (state.view !== defaultViewForKind(state.kind)) {
    params.set('view', state.view);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function consoleNavEqual(
  a: ConsoleNavState,
  b: ConsoleNavState
): boolean {
  return (
    a.section === b.section &&
    a.kind === b.kind &&
    a.instance === b.instance &&
    a.view === b.view
  );
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

/** First `id:view` pair from the old per-client `cv` query key. */
function parseLegacyClientView(
  raw: string | null
): { readonly id: string; readonly view: string } | null {
  if (raw === null || raw.trim() === '') return null;
  const first = raw.split(',')[0]?.trim() ?? '';
  const colon = first.indexOf(':');
  if (colon <= 0) return null;
  const id = first.slice(0, colon).trim();
  const view = first.slice(colon + 1).trim();
  if (id.length === 0 || view.length === 0) return null;
  return { id, view };
}
