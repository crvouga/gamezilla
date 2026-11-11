/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { GamePlayerBar } from '@pkgs/ui-root-client-ts/game-player-bar';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

const LINE_CSS = readFileSync(
  join(
    import.meta.dirname,
    '../../ui-root-client-ts/src/game-player-bar/name-line.module.css'
  ),
  'utf8'
);

/** The body of the top-level rule whose selector is exactly `selector`. */
function rule(css: string, selector: string): string {
  const start = css.indexOf(`\n${selector} {`);
  if (start < 0) throw new Error(`no rule ${selector}`);
  const open = css.indexOf('{', start);
  return css.slice(open + 1, css.indexOf('}', open));
}

// regression: game-player-bar-long-name-one-letter-a-line
test('a long name beside the turn and an inline tag keeps one line and a floor of width', () => {
  const name = 'XenaciousPuffin162';
  expect(rule(LINE_CSS, '.name')).toContain('min-width: 3ch');
  expect(rule(LINE_CSS, '.name,\n.name *')).toContain('white-space: nowrap');
  expect(rule(LINE_CSS, '.who')).toContain('row nowrap');
  expect(rule(LINE_CSS, '.line')).toContain('row wrap');
  renderUi(
    () => (
      <GamePlayerBar
        name={<span>{name}</span>}
        plainName={name}
        tags={<Badge intent="neutral" label="You play White" />}
        tagsPlacement="inline"
        active
        turnLabel="Your move"
      />
    ),
    { width: 390, height: 844 }
  );
  const shown = screen.getByTitle(name);
  expect(shown.textContent).toBe(name);
  // The turn shares the name's line; the tags are that line's sibling, free
  // to drop under it when the strip is narrow.
  const who = shown.parentElement;
  expect(who?.textContent).toBe(`${name}Your move`);
  expect(who?.nextElementSibling?.textContent).toBe('You play White');
});
