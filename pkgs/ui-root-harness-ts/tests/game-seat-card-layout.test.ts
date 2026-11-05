import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: setup-seat-cards-uneven — on a phone the host's setup card
// wrapped "I'm not ready" under "Change player" (its control row indented
// past the avatar) while the bot's card had one row, so a narrow card
// started its controls at its edge.
// regression: setup-seat-controls-differ-by-size — that left a desktop's
// controls indented under the name and a phone's at the card's edge. A
// seat's controls start at the row's edge on every size.
test("a compact seat's controls start at its row's edge on every size", () => {
  const css = readFileSync(
    join(import.meta.dirname, '../../ui-root-client-ts/src/game-ui.module.css'),
    'utf8'
  );
  expect(css).toMatch(
    /\.playerBelow \{[^}]*padding-inline-start:\s*0;[^}]*\}/
  );
  // No other rule indents them at some size.
  const rules = css.match(/[^{}]*\.playerBelow[^{]*\{[^}]*\}/g) ?? [];
  for (const rule of rules) {
    expect(rule).not.toMatch(/padding-inline-start:\s*calc/);
  }
  expect(css).not.toContain('@container seat-card');
});
