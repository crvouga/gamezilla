import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: puzzle-attempt-title-hidden-on-phone — on a phone a game
// screen's heading title is left for a listener only, since the host's bar
// names the game; a puzzle's own name ("Five pairs") vanished with it. A
// heading that keeps its title (`keepTitle`) is exempt from that rule.
test('a phone hides only a heading title the host bar already names', () => {
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
  expect(phone).toMatch(
    /^@container game-column \(max-width: 879px\) \{\s*\.heading:not\(\[data-keep-title="true"\]\) \.headingTitle \{/
  );
});
