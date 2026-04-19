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

function sortByCategoryThenScore(
  a: { command: RegisteredCommand; score: number },
  b: { command: RegisteredCommand; score: number },
): number {
  const ca = a.command.category ?? '';
  const cb = b.command.category ?? '';
  if (ca !== cb) {
    return ca.localeCompare(cb);
  }
  return b.score - a.score;
}

/**
 * Build grouped rows for the palette: optional Recent section, then categories.
 */
export function buildPaletteRows(
  commands: RegisteredCommand[],
  query: string,
  historyIds: string[],
): { rows: PaletteRow[]; selectableCount: number } {
  const byId = new Map(commands.map((c) => [c.id, c] as const));

  const q = query.trim().toLowerCase();
  const candidates: {
    command: RegisteredCommand;
    score: number;
    matchRanges: [number, number][];
  }[] = [];

  for (const cmd of commands) {
    if (!isCommandVisible(cmd)) {
      continue;
    }
    const text = commandSearchText(cmd);
    const match = fuzzyMatch(q, text);
    if (match === null) {
      continue;
    }
    candidates.push({
      command: cmd,
      score: match.score,
      matchRanges: match.ranges,
    });
  }

  if (q !== '') {
    candidates.sort(sortByCategoryThenScore);
    const rows: PaletteRow[] = [];
    let lastCat: string | undefined;
    for (const c of candidates) {
      const cat = c.command.category ?? 'Commands';
      if (cat !== lastCat) {
        rows.push({
          kind: 'header',
          key: `h-${cat}`,
          title: cat,
        });
        lastCat = cat;
      }
      rows.push({
        kind: 'item',
        key: c.command.id,
        command: c.command,
        score: c.score,
        matchRanges: c.matchRanges,
      });
    }
    return {
      rows,
      selectableCount: rows.filter((r) => r.kind === 'item').length,
    };
  }

  // Empty query: Recent first, then remaining by category
  const seen = new Set<string>();
  const recentCommands: RegisteredCommand[] = [];
  for (const hid of historyIds) {
    const cmd = byId.get(hid);
    if (cmd !== undefined && isCommandVisible(cmd) && !seen.has(cmd.id)) {
      recentCommands.push(cmd);
      seen.add(cmd.id);
    }
  }

  const rest = commands.filter((c) => isCommandVisible(c) && !seen.has(c.id));
  rest.sort((a, b) => {
    const ca = a.category ?? '';
    const cb = b.category ?? '';
    if (ca !== cb) {
      return ca.localeCompare(cb);
    }
    return a.title.localeCompare(b.title);
  });

  const rows: PaletteRow[] = [];

  if (recentCommands.length > 0) {
    rows.push({
      kind: 'header',
      key: 'h-recent',
      title: 'Recent',
    });
    for (const cmd of recentCommands) {
      const text = commandSearchText(cmd);
      const match = fuzzyMatch('', text)!;
      rows.push({
        kind: 'item',
        key: cmd.id,
        command: cmd,
        score: match.score,
        matchRanges: match.ranges,
      });
    }
  }

  let lastCat: string | undefined;
  for (const cmd of rest) {
    const cat = cmd.category ?? 'Commands';
    if (cat !== lastCat) {
      rows.push({
        kind: 'header',
        key: `h-${cat}`,
        title: cat,
      });
      lastCat = cat;
    }
    const text = commandSearchText(cmd);
    const match = fuzzyMatch('', text)!;
    rows.push({
      kind: 'item',
      key: cmd.id,
      command: cmd,
      score: match.score,
      matchRanges: match.ranges,
    });
  }

  return {
    rows,
    selectableCount: rows.filter((r) => r.kind === 'item').length,
  };
}
