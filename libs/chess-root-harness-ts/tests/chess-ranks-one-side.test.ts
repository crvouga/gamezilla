import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const LIBS = join(import.meta.dirname, '../..');

/** Every `ranks=` a source file passes its `ChessBoardFrame`. */
function ranksProps(file: string): string[] {
  const source = readFileSync(join(LIBS, file), 'utf8');
  return [...source.matchAll(/\branks=(\{[^}]*\}|"[^"]*")/g)].map(
    (match) => match[1] ?? ''
  );
}

// regression: chess-ranks-switch-sides — a chess game's rank labels stood
// at the board's end on a wide screen and at its start on a phone, so the
// same board read differently by window. Every playing board (a game's and
// a puzzle's, wide and phone) now puts them at the end, where the squares
// still start under the screen's title.
test('chess rank labels stand at the board’s end on every screen', () => {
  const sites = [
    ...ranksProps('chess-root-client-ts/src/chess-game-presentation.tsx'),
    ...ranksProps('chess-puzzle-client-ts/src/chess-puzzle-board.tsx'),
  ];
  expect(sites.length).toBeGreaterThanOrEqual(3);
  for (const site of sites) expect(site).toBe('"end"');
});
