/**
 * Pure host-chrome navigation codec (no wall I/O).
 *
 * URL search keys: host, section, kind, instance, view. Defaults are omitted
 * from the built search so Main product linking stays clean.
 *
 * Legacy `cv=alice:db` becomes `instance=alice` (and `view=db` when needed).
 * View aliases: html→ui, sqlite→db, logs→events.
 */

import {
  coerceDebuggerView,
  type DebuggerViewId,
  defaultViewForKind,
} from '@pkgs/system-console/shared/debugger-views';
import {
  coerceSystemChromeKind,
  type SystemChromeKind,
} from '@pkgs/system-console/shared/system-node';

export type HostId = 'main' | 'console';
export type HostSection = 'reports' | 'playground';
export type HostKind = SystemChromeKind;
export type HostView = DebuggerViewId;

export type HostNavState = {
  readonly host: HostId;
  readonly section: HostSection;
  readonly kind: HostKind;
  readonly instance: string;
  readonly view: HostView;
};

export type HostNavPatch = {
  readonly host?: HostId;
  readonly section?: HostSection;
  readonly kind?: HostKind;
  readonly instance?: string;
  readonly view?: string;
};

export const DEFAULT_HOST_NAV: HostNavState = {
  host: 'main',
  section: 'reports',
  kind: 'client',
  instance: '',
  view: 'ui',
};

const HOST_IDS = new Set<string>(['main', 'console']);
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

export function coerceView(kind: HostKind, view: string): HostView {
  return coerceDebuggerView(kind, view);
}

export function coerceKind(kindRaw: string | null | undefined): HostKind {
  return coerceSystemChromeKind(kindRaw);
}

export function applyHostNavPatch(
  current: HostNavState,
  patch: HostNavPatch
): HostNavState {
  const kind = patch.kind ?? current.kind;
  const viewRaw = patch.view ?? current.view;
  const instanceRaw =
    patch.instance !== undefined ? patch.instance : current.instance;
  return {
    host: patch.host ?? current.host,
    section: patch.section ?? current.section,
    kind,
    instance: normalizeInstance(kind, instanceRaw),
    view: coerceView(kind, viewRaw),
  };
}

export function parseHostNav(search: string): HostNavState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const host = parseHostId(params.get('host'));
  const section = parseSection(params.get('section'));
  const kind = coerceKind(params.get('kind'));
  const instanceParam = params.get('instance')?.trim() ?? '';
  const legacy =
    instanceParam.length === 0 ? parseLegacyClientView(params.get('cv')) : null;
  const instance = normalizeInstance(kind, instanceParam || legacy?.id || '');
  const viewRaw =
    params.get('view') ?? legacy?.view ?? defaultViewForKind(kind);
  return {
    host,
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
export function buildHostSearch(
  state: HostNavState,
  existingSearch = ''
): string {
  const params = new URLSearchParams(
    existingSearch.startsWith('?') ? existingSearch.slice(1) : existingSearch
  );
  for (const key of CHROME_KEYS) params.delete(key);

  if (state.host !== 'main') params.set('host', state.host);
  if (state.host === 'console') {
    if (state.section !== 'reports') params.set('section', state.section);
    if (state.kind !== 'client') params.set('kind', state.kind);
    if (state.instance.length > 0) params.set('instance', state.instance);
    if (state.view !== defaultViewForKind(state.kind)) {
      params.set('view', state.view);
    }
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function hostNavEqual(a: HostNavState, b: HostNavState): boolean {
  return (
    a.host === b.host &&
    a.section === b.section &&
    a.kind === b.kind &&
    a.instance === b.instance &&
    a.view === b.view
  );
}

function parseHostId(raw: string | null): HostId {
  return raw !== null && HOST_IDS.has(raw) ? (raw as HostId) : 'main';
}

function parseSection(raw: string | null): HostSection {
  return raw !== null && SECTIONS.has(raw) ? (raw as HostSection) : 'reports';
}

function normalizeInstance(kind: HostKind, raw: string): string {
  if (kind === 'api' || kind === 'events') return '';
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
