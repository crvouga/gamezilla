/** @jsxImportSource @solidjs/web */

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
    '../../ui-root-client-ts/src/game-player-bar/game-player-bar.module.css'
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

// regression: phone matched seat with its colour tag two lines tall
test("a 'line' seat keeps its tag on the name's line at every width", () => {
  // One tag-high line: whatever wraps off it is out of view, never a row.
  const keep = rule(LINE_CSS, '.line.keep');
  expect(keep).toContain('height: var(--ui-space-6)');
  expect(keep).toContain('overflow: hidden');
  // regression: phone offline seat dropped `Offline` with its second tag
  // Each tag wraps off the line on its own, so one that fits stays.
  expect(rule(LINE_CSS, '.line.keep > .tags')).toContain('display: contents');
  renderUi(
    () => (
      <GamePlayerBar
        name={<span>alice</span>}
        plainName="alice"
        tags={<Badge intent="neutral" label="You play Red" />}
        tagsPlacement="line"
        active
      />
    ),
    { width: 390, height: 844 }
  );
  const who = screen.getByTitle('alice').parentElement;
  const line = who?.parentElement;
  expect(line?.className).toContain('keep');
  expect(who?.nextElementSibling?.textContent).toBe('You play Red');
});

// regression: phone watching seat cut a five-letter name to "ali…"
test("a 'line' seat gives its name the room first: the turn's words follow the name and give way", () => {
  const keep = rule(LINE_CSS, '.line.keep');
  // The turn and the tags wrap off the one line rather than squeeze the
  // name, the line's first item.
  expect(keep).toContain('flex-wrap: wrap');
  renderUi(
    () => (
      <GamePlayerBar
        name={<span>alice</span>}
        plainName="alice"
        swatch={{ color: 'disc-one', mark: '●' }}
        swatchLabel="Red"
        tagsPlacement="line"
        active
        turnLabel="To move"
      />
    ),
    { width: 390, height: 844 }
  );
  const who = screen.getByTitle('alice').parentElement;
  // The name's own group holds only the swatch and the name.
  expect(who?.textContent).toBe('●alice');
  const turn = who?.nextElementSibling;
  expect(turn?.getAttribute('data-component')).toBe('GamePlayerTurn');
  expect(turn?.textContent).toBe('To move');
  expect(who?.parentElement?.className).toContain('keep');
});

// regression: own-seat-you-missing-on-strips — a two-seat game's own strip
// said nothing of whose it was, and a matched seat's `You play Red` gave
// way to an `Offline` before it on a phone. The own mark follows the name
// on its own line, in every placement, ahead of the tags that may hide.
test("a seat's own mark sits after the name on its line, before the tags", () => {
  const name = 'alice';
  renderUi(
    () => (
      <GamePlayerBar
        name={<span>{name}</span>}
        plainName={name}
        nameTag={<Badge intent="info" tone="solid" label="You" />}
        tags={<Badge intent="warning" label="Offline" />}
        tagsPlacement="line"
      />
    ),
    { width: 390, height: 844 }
  );
  const who = screen.getByTitle(name).parentElement;
  expect(who?.textContent).toBe(`${name}You`);
  expect(who?.nextElementSibling?.textContent).toBe('Offline');
});
