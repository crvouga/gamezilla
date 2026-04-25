import { fuzzyMatch } from './fuzzy-match';
import type { RegisteredCommand } from './types';
import { commandSearchText, isCommandVisible } from './types';

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
  matchRanges: [number, number][];
};

export type PaletteRow = PaletteHeaderRow | PaletteItemRow;

type Candidate = {
  command: RegisteredCommand;
  score: number;
  matchRanges: [number, number][];
};

function sortByCategoryThenScore(a: Candidate, b: Candidate): number {
  const ca = a.command.category ?? '';
  const cb = b.command.category ?? '';
  if (ca !== cb) return ca.localeCompare(cb);
  return b.score - a.score;
}

function sortByCategoryThenTitle(
  a: RegisteredCommand,
  b: RegisteredCommand
): number {
  const ca = a.category ?? '';
  const cb = b.category ?? '';
  if (ca !== cb) return ca.localeCompare(cb);
  return a.title.localeCompare(b.title);
}

function fuzzyMatchAll(commands: RegisteredCommand[], q: string): Candidate[] {
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

function pushItem(rows: PaletteRow[], c: Candidate): void {
  rows.push({
    kind: 'item',
    key: c.command.id,
    command: c.command,
    score: c.score,
    matchRanges: c.matchRanges,
  });
}

function pushCategoryHeader(
  rows: PaletteRow[],
  cat: string,
  lastCat: string | undefined
): string {
  if (cat === lastCat) return cat;
  rows.push({ kind: 'header', key: `h-${cat}`, title: cat });
  return cat;
}

function buildSearchRows(
  commands: RegisteredCommand[],
  q: string
): PaletteRow[] {
  const candidates = fuzzyMatchAll(commands, q);
  candidates.sort(sortByCategoryThenScore);
  const rows: PaletteRow[] = [];
  let lastCat: string | undefined;
  for (const c of candidates) {
    const cat = c.command.category ?? 'Commands';
    lastCat = pushCategoryHeader(rows, cat, lastCat);
    pushItem(rows, c);
  }
  return rows;
}

function collectRecent(
  commands: RegisteredCommand[],
  historyIds: string[]
): { recent: RegisteredCommand[]; recentIds: Set<string> } {
  const byId = new Map(commands.map((c) => [c.id, c] as const));
  const recentIds = new Set<string>();
  const recent: RegisteredCommand[] = [];
  for (const hid of historyIds) {
    const cmd = byId.get(hid);
    if (cmd === undefined || !isCommandVisible(cmd)) continue;
    if (recentIds.has(cmd.id)) continue;
    recent.push(cmd);
    recentIds.add(cmd.id);
  }
  return { recent, recentIds };
}

function commandToCandidate(cmd: RegisteredCommand): Candidate {
  const match = fuzzyMatch('', commandSearchText(cmd))!;
  return { command: cmd, score: match.score, matchRanges: match.ranges };
}

function buildRecentRows(
  commands: RegisteredCommand[],
  historyIds: string[]
): PaletteRow[] {
  const { recent, recentIds } = collectRecent(commands, historyIds);
  const rest = commands
    .filter((c) => isCommandVisible(c) && !recentIds.has(c.id))
    .sort(sortByCategoryThenTitle);

  const rows: PaletteRow[] = [];
  if (recent.length > 0) {
    rows.push({ kind: 'header', key: 'h-recent', title: 'Recent' });
    for (const cmd of recent) pushItem(rows, commandToCandidate(cmd));
  }

  let lastCat: string | undefined;
  for (const cmd of rest) {
    const cat = cmd.category ?? 'Commands';
    lastCat = pushCategoryHeader(rows, cat, lastCat);
    pushItem(rows, commandToCandidate(cmd));
  }
  return rows;
}

/**
 * Build grouped rows for the palette: optional Recent section, then categories.
 */
export function buildPaletteRows(
  commands: RegisteredCommand[],
  query: string,
  historyIds: string[]
): { rows: PaletteRow[]; selectableCount: number } {
  const q = query.trim().toLowerCase();
  const rows =
    q !== '' ? buildSearchRows(commands, q) : buildRecentRows(commands, historyIds);
  return {
    rows,
    selectableCount: rows.filter((r) => r.kind === 'item').length,
  };
}
