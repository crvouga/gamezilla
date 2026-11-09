import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../..');
const read = (path: string) => readFileSync(join(repo, path), 'utf8');

/** The rule for `selector` at the start of a line (indented or not), not a nested use. */
function rule(sheet: string, selector: string): string {
  const start = sheet.search(new RegExp(`^\\s*\\${selector} \\{`, 'm'));
  return start < 0
    ? ''
    : (sheet.slice(start).split('{')[1]?.split('}')[0] ?? '');
}

// regression: player-chip-grows-when-a-badge-appears — a chip's facts line
// was a text line tall until a state badge (Out) or a You badge appeared,
// which made the chip taller mid-game and moved the board below it.
test("a player chip's facts line is a badge tall with or without a badge", () => {
  const badge = /min-height: (var\(--ui-space-[a-z0-9]+\));/.exec(
    rule(read('pkgs/ui-root-client-ts/skin.css'), '.badge')
  )?.[1];
  expect(badge).toBeDefined();
  expect(
    rule(
      read(
        'pkgs/ui-root-client-ts/src/game-player-rail/game-player-rail.module.css'
      ),
      '.chipFacts'
    )
  ).toContain(`min-height: ${badge ?? ''};`);
});
