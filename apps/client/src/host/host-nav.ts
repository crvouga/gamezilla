/**
 * Pure host-chrome navigation codec (no wall I/O).
 *
 * URL search keys: host, section, kind, view, cv. Defaults are omitted from
 * the built search so Main product linking stays clean.
 *
 * `view` is the shared panel tab for server / pubsub / room.
 * `cv` encodes per-client tabs as `alice:db,bob:logs`.
 */

export type HostId = 'main' | 'console';
export type HostSection = 'reports' | 'playground';
export type HostKind = 'client' | 'server' | 'pubsub' | 'room';
export type HostView = string;

export type HostNavState = {
  readonly host: HostId;
  readonly section: HostSection;
  readonly kind: HostKind;
  readonly view: HostView;
  /** Per playground client instance panel tab (`alice` → `db`, …). */
  readonly clientViews: Readonly<Record<string, string>>;
};

export type HostNavPatch = {
  readonly host?: HostId;
  readonly section?: HostSection;
  readonly kind?: HostKind;
  readonly view?: HostView;
  /** When set, replaces the entire clientViews map. */
  readonly clientViews?: Readonly<Record<string, string>>;
  /** When set, updates one client tab (merged onto current clientViews). */
  readonly clientView?: { readonly id: string; readonly view: string };
};

export const DEFAULT_HOST_NAV: HostNavState = {
  host: 'main',
  section: 'reports',
  kind: 'client',
  view: 'ui',
  clientViews: {},
};

const HOST_IDS = new Set<string>(['main', 'console']);
const SECTIONS = new Set<string>(['reports', 'playground']);
const KINDS = new Set<string>(['client', 'server', 'pubsub', 'room']);
const KIND_ALIASES: Readonly<Record<string, HostKind>> = { actor: 'room' };

const VIEWS_BY_KIND: Record<HostKind, readonly string[]> = {
  client: ['ui', 'db', 'logs'],
  server: ['db', 'logs', 'commands'],
  pubsub: ['logs', 'topics'],
  room: ['db', 'logs'],
};

const DEFAULT_VIEW_BY_KIND: Record<HostKind, string> = {
  client: 'ui',
  server: 'db',
  pubsub: 'logs',
  room: 'db',
};

const CLIENT_DEFAULT_VIEW = DEFAULT_VIEW_BY_KIND.client;

const CHROME_KEYS = ['host', 'section', 'kind', 'view', 'cv'] as const;

export function defaultViewForKind(kind: HostKind): string {
  return DEFAULT_VIEW_BY_KIND[kind];
}

export function coerceView(kind: HostKind, view: string): string {
  const allowed = VIEWS_BY_KIND[kind];
  if (allowed.includes(view)) return view;
  return DEFAULT_VIEW_BY_KIND[kind];
}

function coerceClientView(view: string): string {
  return coerceView('client', view);
}

export function setClientView(
  state: HostNavState,
  clientId: string,
  view: string
): HostNavState {
  const id = clientId.trim();
  if (id.length === 0) return state;
  const nextView = coerceClientView(view);
  const prev = state.clientViews[id];
  if (prev === nextView) return state;
  if (prev === undefined && nextView === CLIENT_DEFAULT_VIEW) return state;
  const clientViews = { ...state.clientViews };
  if (nextView === CLIENT_DEFAULT_VIEW) {
    delete clientViews[id];
  } else {
    clientViews[id] = nextView;
  }
  return { ...state, clientViews };
}

function parseClientViews(raw: string | null): Record<string, string> {
  if (raw === null || raw.trim() === '') return {};
  const out: Record<string, string> = {};
  for (const part of raw.split(',')) {
    const trimmed = part.trim();
    if (trimmed.length === 0) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const id = trimmed.slice(0, colon).trim();
    const view = trimmed.slice(colon + 1).trim();
    if (id.length === 0 || view.length === 0) continue;
    const coerced = coerceClientView(view);
    if (coerced !== CLIENT_DEFAULT_VIEW) out[id] = coerced;
  }
  return out;
}

function serializeClientViews(
  clientViews: Readonly<Record<string, string>>
): string | null {
  const parts: string[] = [];
  for (const id of Object.keys(clientViews).sort()) {
    const view = clientViews[id];
    if (view === undefined) continue;
    const coerced = coerceClientView(view);
    if (coerced === CLIENT_DEFAULT_VIEW) continue;
    parts.push(`${id}:${coerced}`);
  }
  return parts.length > 0 ? parts.join(',') : null;
}

function clientViewsEqual(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) return false;
  for (let i = 0; i < aKeys.length; i += 1) {
    const key = aKeys[i]!;
    if (key !== bKeys[i] || a[key] !== b[key]) return false;
  }
  return true;
}

function normalizeClientViews(
  raw: Readonly<Record<string, string>> | undefined
): Record<string, string> {
  if (raw === undefined) return {};
  const out: Record<string, string> = {};
  for (const [id, view] of Object.entries(raw)) {
    const coerced = coerceClientView(view);
    if (coerced !== CLIENT_DEFAULT_VIEW) out[id] = coerced;
  }
  return out;
}

export function applyHostNavPatch(
  current: HostNavState,
  patch: HostNavPatch
): HostNavState {
  const kind = patch.kind ?? current.kind;
  const viewRaw = patch.view ?? current.view;
  const clientViews =
    patch.clientViews !== undefined
      ? normalizeClientViews(patch.clientViews)
      : current.clientViews;
  let next: HostNavState = {
    host: patch.host ?? current.host,
    section: patch.section ?? current.section,
    kind,
    view: coerceView(kind, viewRaw),
    clientViews,
  };
  if (patch.clientView !== undefined) {
    next = setClientView(next, patch.clientView.id, patch.clientView.view);
  }
  return next;
}

export function coerceKind(kindRaw: string | null | undefined): HostKind {
  if (kindRaw === null || kindRaw === undefined) return 'client';
  const aliased = KIND_ALIASES[kindRaw] ?? kindRaw;
  return KINDS.has(aliased) ? (aliased as HostKind) : 'client';
}

export function parseHostNav(search: string): HostNavState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const hostRaw = params.get('host');
  const host: HostId =
    hostRaw !== null && HOST_IDS.has(hostRaw) ? (hostRaw as HostId) : 'main';
  const sectionRaw = params.get('section');
  const section: HostSection =
    sectionRaw !== null && SECTIONS.has(sectionRaw)
      ? (sectionRaw as HostSection)
      : 'reports';
  const kindRaw = params.get('kind');
  const kind = coerceKind(kindRaw);
  const viewRaw = params.get('view') ?? DEFAULT_VIEW_BY_KIND[kind];
  return {
    host,
    section,
    kind,
    view: coerceView(kind, viewRaw),
    clientViews: parseClientViews(params.get('cv')),
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
    const def = DEFAULT_VIEW_BY_KIND[state.kind];
    if (state.view !== def) params.set('view', state.view);
    const cv = serializeClientViews(state.clientViews);
    if (cv !== null) params.set('cv', cv);
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function hostNavEqual(a: HostNavState, b: HostNavState): boolean {
  return (
    a.host === b.host &&
    a.section === b.section &&
    a.kind === b.kind &&
    a.view === b.view &&
    clientViewsEqual(a.clientViews, b.clientViews)
  );
}
