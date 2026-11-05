import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: setup-seat-cards-uneven — on a phone the host's setup card
// wrapped "I'm not ready" under "Change player" (its control row indented
// past the avatar) while the bot's card had one row: a narrow compact seat
// card starts its controls at its edge so they keep one row.
test("a narrow compact seat card's controls start at its edge", () => {
  const css = readFileSync(
    join(import.meta.dirname, '../../ui-root-client-ts/src/game-ui.module.css'),
    'utf8'
  );
  expect(css).toMatch(
    /\.player\[data-density="compact"\]\s*\{\s*container:\s*seat-card \/ inline-size;/
  );
  const query = css.slice(
    css.indexOf('@container seat-card (max-width: 20rem)')
  );
  // Beats the base rule declared after it: a descendant selector.
  expect(query).toMatch(
    /^@container seat-card[^{]*\{\s*\.player \.playerBelow\s*\{\s*padding-inline-start:\s*0;/
  );
});
