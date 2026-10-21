/**
 * Framework-free ranking + grouping for the command palette: fuzzy-filter
 * the registry by the query, or (empty query) list recent commands first and
 * the rest grouped by category.
 */

import type { MatchRange } from '@pkgs/ui-root-shared-ts/fuzzy-match';
import { fuzzyMatch } from '@pkgs/ui-root-shared-ts/fuzzy-match';
import type { CommandGroup, RegisteredCommand } from './types';
import { commandSearchText, isCommandVisible } from './types';

/** Title of the leading section when the query is empty and history exists. */
export const RECENT_SECTION_TITLE = 'Recent';
/** Fallback category for commands without one. */
export const DEFAULT_CATEGORY = 'Commands';

export type PaletteHeaderRow = {
  kind: 'header';
  key: string;
  title: string;
};

export type PaletteItemRow = {
  kind: 'item';
  key: string;
  command: RegisteredCommand;
  score: number;
  matchRanges: MatchRange[];
};

export type PaletteRow = PaletteHeaderRow | PaletteItemRow;

export type PaletteRows = {
  rows: PaletteRow[];
  selectableCount: number;
};

type Candidate = {
  command: RegisteredCommand;
  score: number;
  matchRanges: MatchRange[];
};

function categoryOf(cmd: RegisteredCommand): string {
  return cmd.category ?? DEFAULT_CATEGORY;
}

function compareCategory(a: RegisteredCommand, b: RegisteredCommand): number {
  const ca = a.category ?? '';
  const cb = b.category ?? '';
  return ca === cb ? 0 : ca.localeCompare(cb);
}

function fuzzyMatchAll(
  commands: readonly RegisteredCommand[],
  q: string
): Candidate[] {
  const candidates: Candidate[] = [];
  for (const cmd of commands) {
    if (!isCommandVisible(cmd)) continue;
    const match = fuzzyMatch(q, commandSearchText(cmd));
    if (match === null) continue;
    candidates.push({
      command: cmd,
      score: match.score,
      matchRanges: match.ranges,
    });
  }
  return candidates;
}

function itemRow(c: Candidate): PaletteItemRow {
  return {
    kind: 'item',
    key: c.command.id,
    command: c.command,
    score: c.score,
    matchRanges: c.matchRanges,
  };
}

function headerRow(title: string, key: string): PaletteHeaderRow {
  return { kind: 'header', key, title };
}

/** Flatten candidates (already sorted by category) into header + item rows. */
function groupByCategory(candidates: readonly Candidate[]): PaletteRow[] {
  const rows: PaletteRow[] = [];
  let lastCategory: string | undefined;
  for (const c of candidates) {
    const category = categoryOf(c.command);
    if (category !== lastCategory) {
      rows.push(headerRow(category, `h-${category}`));
      lastCategory = category;
    }
    rows.push(itemRow(c));
  }
  return rows;
}

function buildSearchRows(
  commands: readonly RegisteredCommand[],
  q: string
): PaletteRow[] {
  const candidates = fuzzyMatchAll(commands, q);
  candidates.sort(
    (a, b) => compareCategory(a.command, b.command) || b.score - a.score
  );
  return groupByCategory(candidates);
}

function collectRecent(
  commands: readonly RegisteredCommand[],
  historyIds: readonly string[]
): RegisteredCommand[] {
  const byId = new Map(commands.map((c) => [c.id, c] as const));
  const seen = new Set<string>();
  const recent: RegisteredCommand[] = [];
  for (const id of historyIds) {
    const cmd = byId.get(id);
    if (cmd === undefined || !isCommandVisible(cmd) || seen.has(cmd.id)) {
      continue;
    }
    recent.push(cmd);
    seen.add(cmd.id);
  }
  return recent;
}

function unscored(cmd: RegisteredCommand): Candidate {
  return { command: cmd, score: 0, matchRanges: [] };
}

function buildRecentRows(
  commands: readonly RegisteredCommand[],
  historyIds: readonly string[]
): PaletteRow[] {
  const recent = collectRecent(commands, historyIds);
  const recentIds = new Set(recent.map((c) => c.id));
  const rest = commands
    .filter((c) => isCommandVisible(c) && !recentIds.has(c.id))
    .sort((a, b) => compareCategory(a, b) || a.title.localeCompare(b.title));

  const rows: PaletteRow[] = [];
  if (recent.length > 0) {
    rows.push(headerRow(RECENT_SECTION_TITLE, 'h-recent'));
    for (const cmd of recent) rows.push(itemRow(unscored(cmd)));
  }
  rows.push(...groupByCategory(rest.map(unscored)));
  return rows;
}

/**
 * Build grouped rows for the palette: fuzzy results by category when the
 * query is set; otherwise an optional Recent section, then categories.
 */
export function buildPaletteRows(
  commands: readonly RegisteredCommand[],
  query: string,
  historyIds: readonly string[]
): PaletteRows {
  const q = query.trim().toLowerCase();
  const rows =
    q !== ''
      ? buildSearchRows(commands, q)
      : buildRecentRows(commands, historyIds);
  return {
    rows,
    selectableCount: rows.filter((r) => r.kind === 'item').length,
  };
}

/** Item rows only, in display order (the keyboard-selectable sequence). */
export function selectableRows(rows: readonly PaletteRow[]): PaletteItemRow[] {
  return rows.filter((r): r is PaletteItemRow => r.kind === 'item');
}

/** Collapse rows back into `{ title, commands }` sections. */
export function groupPaletteRows(rows: readonly PaletteRow[]): CommandGroup[] {
  const groups: { title: string; commands: RegisteredCommand[] }[] = [];
  for (const row of rows) {
    if (row.kind === 'header') {
      groups.push({ title: row.title, commands: [] });
      continue;
    }
    const last = groups[groups.length - 1];
    if (last === undefined) {
      groups.push({ title: DEFAULT_CATEGORY, commands: [row.command] });
    } else {
      last.commands.push(row.command);
    }
  }
  return groups;
}
