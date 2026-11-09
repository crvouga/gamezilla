/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  GamePlayerChip,
  GamePlayerRail,
} from '@pkgs/ui-root-client-ts/game-player-rail';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

const RAIL_CSS = join(
  import.meta.dirname,
  '../../ui-root-client-ts/src/game-player-rail/game-player-rail.module.css'
);

/** The body of the top-level rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

// regression: game-player-rail-name-breaks-mid-word
test('a long underscore name stays on one line and keeps the full name readable', () => {
  const name = 'jordan_plays_every_friday_night';
  const chipName = rule(readFileSync(RAIL_CSS, 'utf8'), '.chipName');
  expect(chipName).toContain('white-space: nowrap');
  expect(chipName).toContain('text-overflow: ellipsis');
  expect(chipName).toContain('overflow: hidden');
  expect(chipName).not.toContain('overflow-wrap: anywhere');
  renderUi(() => (
    <GamePlayerRail aria-label="Players">
      <GamePlayerChip name={name} />
      <GamePlayerChip name="avery" />
      <GamePlayerChip name="morgan" />
    </GamePlayerRail>
  ));
  const shown = screen.getByText(name);
  expect(shown.textContent).toBe(name);
  expect(shown.getAttribute('title')).toBe(name);
});
