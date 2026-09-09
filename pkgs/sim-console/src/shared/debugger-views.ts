/**
 * Shared debugger view ids (playground + reports).
 * Persisted report aliases: html → ui, sqlite → db, logs → events.
 */

import { coerceSimChromeKind, type SimChromeKind } from './sim-node';

export const DEBUGGER_VIEW_IDS = [
  'ui',
  'db',
  'events',
  'commands',
  'topics',
] as const;

export type DebuggerViewId = (typeof DEBUGGER_VIEW_IDS)[number];

const VIEW_SET: ReadonlySet<string> = new Set(DEBUGGER_VIEW_IDS);

const VIEW_ALIASES: Readonly<Record<string, DebuggerViewId>> = {
  html: 'ui',
  sqlite: 'db',
  logs: 'events',
};

export const VIEWS_BY_KIND: Readonly<
  Record<SimChromeKind, readonly DebuggerViewId[]>
> = {
  client: ['ui'],
  server: ['db', 'events', 'commands'],
  events: ['events', 'topics'],
  room: ['db', 'events'],
};

export const DEFAULT_VIEW_BY_KIND: Readonly<
  Record<SimChromeKind, DebuggerViewId>
> = {
  client: 'ui',
  server: 'db',
  events: 'events',
  room: 'db',
};

export type ViewsForKindOptions = {
  readonly hasCommands?: boolean;
  readonly hasTopics?: boolean;
};

export function aliasDebuggerView(raw: string): string {
  return VIEW_ALIASES[raw] ?? raw;
}

export function coerceDebuggerView(
  kind: string,
  raw: string | null | undefined
): DebuggerViewId {
  const chrome = coerceSimChromeKind(kind);
  const aliased = aliasDebuggerView(raw ?? '');
  const allowed = VIEWS_BY_KIND[chrome];
  if (VIEW_SET.has(aliased) && allowed.includes(aliased as DebuggerViewId)) {
    return aliased as DebuggerViewId;
  }
  return DEFAULT_VIEW_BY_KIND[chrome];
}

export function defaultViewForKind(kind: SimChromeKind): DebuggerViewId {
  return DEFAULT_VIEW_BY_KIND[kind];
}

export function viewsForKind(
  kind: SimChromeKind,
  options?: ViewsForKindOptions
): readonly DebuggerViewId[] {
  const chrome = coerceSimChromeKind(kind);
  const all = VIEWS_BY_KIND[chrome];
  return all.filter((view) => {
    if (view === 'commands' && options?.hasCommands === false) return false;
    if (view === 'topics' && options?.hasTopics === false) return false;
    return true;
  });
}
