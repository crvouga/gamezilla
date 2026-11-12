/**
 * Pure harness navigation codec (no wall I/O).
 *
 * URL search keys:
 * - `layout`: the window layout, as `serializeWindowLayout` writes it
 * - `cv`: the view each node's panel shows, `panel:view,…`
 *
 * Defaults are omitted from the built search: no `layout` is the starting
 * arrangement, and a panel on its kind's first view has no `cv` entry.
 */

import type { DebuggerViewId } from '@pkgs/harness-console-shared-ts/debugger-views';
import {
  coerceDebuggerView,
  defaultViewForKind,
} from '@pkgs/harness-console-shared-ts/debugger-views';
import { harnessPanelKind } from '@pkgs/harness-console-shared-ts/harness-windows';
import {
  parseWindowLayout,
  serializeWindowLayout,
} from '@pkgs/ui-devtools-shared-ts/window-layout-codec';

export type ConsoleView = DebuggerViewId;

export type PaneNav = {
  readonly view: ConsoleView;
};

export type ConsoleNavState = {
  /** Serialized window layout; `null` is the starting arrangement. */
  readonly layout: string | null;
  /** Panel id → the view it shows, for panels off their default view. */
  readonly panes: Readonly<Record<string, PaneNav>>;
};

export type PaneNavPatch = {
  readonly view?: string;
};

export type ConsoleNavPatch = {
  readonly layout?: string | null;
  /** Patch a single pane by panel id. */
  readonly pane?: { readonly id: string; readonly patch: PaneNavPatch };
};

export const DEFAULT_CONSOLE_NAV: ConsoleNavState = {
  layout: null,
  panes: {},
};

const NAV_KEYS = ['layout', 'cv'] as const;

function searchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

function defaultView(panel: string): ConsoleView {
  return defaultViewForKind(harnessPanelKind(panel));
}

/** A layout in the one spelling the codec writes, or `null` for none. */
function canonicalLayout(text: string | null | undefined): string | null {
  if (text === null || text === undefined) return null;
  const layout = parseWindowLayout(text);
  return layout === null ? null : serializeWindowLayout(layout);
}

function withPane(
  panes: Readonly<Record<string, PaneNav>>,
  id: string,
  view: string
): Readonly<Record<string, PaneNav>> {
  const { [id]: _dropped, ...rest } = panes;
  const coerced = coerceDebuggerView(harnessPanelKind(id), view);
  return coerced === defaultView(id)
    ? rest
    : { ...rest, [id]: { view: coerced } };
}

/** The view a panel shows: its own entry, else its kind's first view. */
export function resolvePaneNav(state: ConsoleNavState, panel: string): PaneNav {
  return state.panes[panel] ?? { view: defaultView(panel) };
}

export function applyConsoleNavPatch(
  current: ConsoleNavState,
  patch: ConsoleNavPatch
): ConsoleNavState {
  const view = patch.pane?.patch.view;
  return {
    layout:
      patch.layout === undefined
        ? current.layout
        : canonicalLayout(patch.layout),
    panes:
      patch.pane === undefined || view === undefined
        ? current.panes
        : withPane(current.panes, patch.pane.id, view),
  };
}

function parsePanes(raw: string | null): Readonly<Record<string, PaneNav>> {
  let panes: Readonly<Record<string, PaneNav>> = {};
  for (const part of (raw ?? '').split(',')) {
    // Panel ids hold colons (`server:server-a`); the view is the last piece.
    const cut = part.lastIndexOf(':');
    if (cut <= 0) continue;
    const id = decodeURIComponent(part.slice(0, cut)).trim();
    if (id.length > 0) panes = withPane(panes, id, part.slice(cut + 1).trim());
  }
  return panes;
}

export function parseConsoleNav(search: string): ConsoleNavState {
  const params = searchParams(search);
  return {
    layout: canonicalLayout(params.get('layout')),
    panes: parsePanes(params.get('cv')),
  };
}

/**
 * Build a search string from nav state, preserving the other query keys of
 * `existingSearch`.
 */
export function buildConsoleSearch(
  state: ConsoleNavState,
  existingSearch = ''
): string {
  const params = searchParams(existingSearch);
  for (const key of NAV_KEYS) params.delete(key);
  if (state.layout !== null) params.set('layout', state.layout);
  const cv = Object.keys(state.panes)
    .sort()
    .map((id) => `${encodeURIComponent(id)}:${state.panes[id]?.view ?? ''}`)
    .join(',');
  if (cv.length > 0) params.set('cv', cv);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function consoleNavEqual(
  a: ConsoleNavState,
  b: ConsoleNavState
): boolean {
  return buildConsoleSearch(a) === buildConsoleSearch(b);
}
