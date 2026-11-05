/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { screen } from '@solidjs/testing-library';
import { mustQuery, renderUi } from './render';

// regression: phone-game-title-repeated — on a phone the space's top bar
// said "Chess" and the body said "Chess" again in the display face over
// its Unrated / Untimed chips, pushing the board down. A game in play keeps
// its title for a listener and, on a phone's column, shows only its facts.
test('a phone game in play shows its facts and keeps its title for a listener', () => {
  renderUi(() => (
    <GameScreen screenId="chess" title="Chess" facts={<span>Unrated</span>}>
      <p class="text">{'board'}</p>
    </GameScreen>
  ));
  expect(screen.getByRole('heading', { level: 1, name: 'Chess' })).toBeTruthy();
  const title = mustQuery('[data-component="GameHeadingTitle"]');
  expect(title.contains(screen.getByRole('heading', { level: 1 }))).toBe(true);
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../ui-root-client-ts/src/game-screen/game-heading.module.css'
    ),
    'utf8'
  );
  const narrow = css.slice(
    css.indexOf('@container game-column (max-width: 879px)')
  );
  // A game in play leaves the title to the host's bar; only a heading that
  // keeps its title (a puzzle's own name) is exempt.
  expect(
    mustQuery('[data-component="GameHeading"]').getAttribute('data-keep-title')
  ).toBe('false');
  expect(narrow).toMatch(
    /^@container game-column \(max-width: 879px\)\s*\{\s*\.heading:not\(\[data-keep-title="true"\]\) \.headingTitle\s*\{[^}]*clip:/
  );
});
