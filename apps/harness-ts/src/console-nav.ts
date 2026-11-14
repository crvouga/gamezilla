/**
 * Pure harness navigation codec (no wall I/O).
 *
 * URL search keys:
 * - `show`: the panel on show (`client:bob`, `server:server-a`, `lb`, …)
 * - `cv`: the view each node's panel shows, `panel:view,…`
 * - `sw`: what was changed in the switcher, `view,-view,…`: a view put in
 *   it, or with `-` a client's app taken out
 *
 * Defaults are omitted from the built search: no `show` is the first
 * client, a panel on its kind's first view has no `cv` entry, and a
 * switcher of every client's app has no `sw`.
 */

import type { DebuggerViewId } from '@pkgs/harness-console-shared-ts/debugger-views';
import {
  coerceDebuggerView,
  defaultViewForKind,
} from '@pkgs/harness-console-shared-ts/debugger-views';
import {
  DEFAULT_HARNESS_SWITCHER,
  type HarnessSwitcherChoice,
  harnessPanelKind,
  harnessSwitcherWith,
} from '@pkgs/harness-console-shared-ts/harness-windows';

export type ConsoleView = DebuggerViewId;

export type PaneNav = {
  readonly view: ConsoleView;
};

export type ConsoleNavState = {
  /** The panel on show; `null` is the first client's. */
  readonly show: string | null;
  /** Panel id → the view it shows, for panels off their default view. */
  readonly panes: Readonly<Record<string, PaneNav>>;
  /** Which views the switcher goes through, as changes from its start. */
  readonly switcher: HarnessSwitcherChoice;
};

export type PaneNavPatch = {
  readonly view?: string;
};

export type ConsoleNavPatch = {
  readonly show?: string | null;
  /** Patch a single pane by panel id. */
  readonly pane?: { readonly id: string; readonly patch: PaneNavPatch };
  /** Put one view in the switcher, or take it out. */
  readonly switcher?: { readonly view: string; readonly on: boolean };
};

export const DEFAULT_CONSOLE_NAV: ConsoleNavState = {
  show: null,
  panes: {},
  switcher: DEFAULT_HARNESS_SWITCHER,
};

const NAV_KEYS = ['show', 'cv', 'sw'] as const;

function searchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

function defaultView(panel: string): ConsoleView {
  return defaultViewForKind(harnessPanelKind(panel));
}

/** A panel id as given, or `null` for none. */
function shownPanel(text: string | null | undefined): string | null {
  const panel = (text ?? '').trim();
  return panel.length === 0 ? null : panel;
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
    show: patch.show === undefined ? current.show : shownPanel(patch.show),
    panes:
      patch.pane === undefined || view === undefined
        ? current.panes
        : withPane(current.panes, patch.pane.id, view),
    switcher:
      patch.switcher === undefined
        ? current.switcher
        : harnessSwitcherWith(
            current.switcher,
            patch.switcher.view,
            patch.switcher.on
          ),
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

function parseSwitcher(raw: string | null): HarnessSwitcherChoice {
  let choice = DEFAULT_HARNESS_SWITCHER;
  for (const part of (raw ?? '').split(',')) {
    const out = part.startsWith('-');
    const view = decodeURIComponent(out ? part.slice(1) : part).trim();
    // Through the one rule for a change, so only a real one is kept: a
    // client's app put in, or another view taken out, is how it starts.
    if (view.length > 0) choice = harnessSwitcherWith(choice, view, !out);
  }
  return choice;
}

export function parseConsoleNav(search: string): ConsoleNavState {
  const params = searchParams(search);
  return {
    show: shownPanel(params.get('show')),
    panes: parsePanes(params.get('cv')),
    switcher: parseSwitcher(params.get('sw')),
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
  if (state.show !== null) params.set('show', state.show);
  const cv = Object.keys(state.panes)
    .sort()
    .map((id) => `${encodeURIComponent(id)}:${state.panes[id]?.view ?? ''}`)
    .join(',');
  if (cv.length > 0) params.set('cv', cv);
  const sw = [
    ...[...state.switcher.added].sort().map(encodeURIComponent),
    ...[...state.switcher.removed]
      .sort()
      .map((view) => `-${encodeURIComponent(view)}`),
  ].join(',');
  if (sw.length > 0) params.set('sw', sw);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function consoleNavEqual(
  a: ConsoleNavState,
  b: ConsoleNavState
): boolean {
  return buildConsoleSearch(a) === buildConsoleSearch(b);
}
