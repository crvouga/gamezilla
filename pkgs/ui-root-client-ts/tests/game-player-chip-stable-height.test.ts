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

// regression: player-chip-grows-when-a-badge-appears — beside a wide board
// three or more chips share its width, so a rider's round wins and an Out
// badge took a second facts line only once the rider went Out, and the
// arena below moved. The facts are one line a badge tall from the start
// there; a fact with no room steps onto a hidden line a full line below.
// regression: chip-facts-hidden-wrap-slivers — that hidden line started
// right under the shown one, so 2-3px of a stepped-aside tag showed along
// the chip's bottom edge.
test('three or more chips beside a wide board keep one facts line, no sliver of the next', () => {
  const sheet = read(
    'pkgs/ui-root-client-ts/src/game-player-rail/game-player-rail.module.css'
  );
  // The last wide block: the one that sets the chips' facts.
  const wide = sheet.slice(
    sheet.lastIndexOf('@container game-column (min-width: 880px)')
  );
  const selector = '.playerRail:has(> :nth-child(3)) .chipFacts {';
  const body = wide.slice(wide.indexOf(selector) + selector.length);
  expect(wide.indexOf(selector)).toBeGreaterThan(0);
  const facts = body.slice(0, body.indexOf('}'));
  expect(facts).toContain('height: var(--ui-space-xl);');
  expect(facts).toContain('row-gap: var(--ui-space-xl);');
  expect(facts).toContain('overflow: hidden;');
});
