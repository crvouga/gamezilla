import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: puzzle-attempt-title-hidden-on-phone — on a phone a game
// screen's heading title was left for a listener only, since the host's bar
// names the game, and a puzzle's own name ("Five pairs") vanished with it.
// A phone now shows every heading's title (compact), so no title is hidden.
test('a phone never hides a heading title, a puzzle name included', () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/game-screen/game-heading.module.css'
    ),
    'utf8'
  );
  const phone = css.slice(
    css.indexOf('@container game-column (max-width: 879px)')
  );
  expect(phone).not.toContain('clip:');
  expect(phone).toMatch(/\.headingTitle h1\s*\{[^}]*font-size:/);
});
