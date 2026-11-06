/** @jsxImportSource solid-js */
/** Each board is named once: by the switch beside it, or its own title side by side. */
import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { cleanup } from '@solidjs/testing-library';
import { byTestId, renderBoard } from './render';

afterEach(cleanup);

const FLEET =
  'fleet:carrier@c3h;battleship@a5h;cruiser@a7h;submarine@a9h;destroyer@j1v';

// regression: battleship-board-named-twice
test('a board shown behind the switch is not titled again under it', () => {
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition(['a1:hit'])}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={FLEET}
      hand={null}
      committed={[]}
      commitment={null}
      testId="board"
      onAction={() => undefined}
    />
  ));
  const pair = byTestId('board-view');
  // Each panel carries one title, which shows only while both panels show
  // side by side (the pair's own container rule); nothing else heads it.
  const titles = [...pair.querySelectorAll('h3')].map((h) => h.textContent);
  expect(titles).toEqual(['Your fleet', 'Targeting']);
  for (const panel of pair.querySelectorAll('section[data-panel]')) {
    const headings = panel.querySelectorAll('h1, h2, h3, h4, h5, h6');
    expect(headings).toHaveLength(1);
    // The pair's title, hidden behind the switch, not a heading of the game's.
    expect(headings[0]?.getAttribute('data-component')).toBe(
      'PairedPanelsTitle'
    );
  }
});

// regression: battleship-board-narrower-than-seats — the 10×10 grid stopped
// at 44px cells (466px) under the 540px seat strips above and below it:
// the board fills its column, edge to edge with the seats.
test('the board fills its column, edge to edge with the seats', () => {
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition(['a1:hit'])}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={FLEET}
      hand={null}
      committed={[]}
      commitment={null}
      testId="board"
      onAction={() => undefined}
    />
  ));
  for (const view of ['fleet', 'target'] as const) {
    const grid = document.querySelector(`[data-testid="board-${view}-grid"]`);
    if (grid === null) continue;
    expect(grid.getAttribute('data-fill')).toBe('true');
  }
  expect(
    document.querySelectorAll('[data-fill="true"]').length
  ).toBeGreaterThan(0);
});

// regression: battleship-marks-unexplained — nothing said which mark was a
// miss, a hit or a sunk ship (outlined ✕ against filled ✖). A key under the
// boards draws each mark as the grid does, beside its name; a watcher, who
// sees no fleet, is not shown a ship.
test('a key under the boards names every mark the grids draw', () => {
  const board = (setup: string | null) =>
    renderBoard(() => (
      <BattleshipBoard
        position={encodeBattleshipPosition(['a1:hit'])}
        orientation="white"
        interactive={setup !== null}
        sound={false}
        syncKey={0}
        setup={setup}
        hand={null}
        committed={[]}
        commitment={null}
        testId="board"
        onAction={() => undefined}
      />
    ));
  board(FLEET);
  const key = byTestId('board-key');
  const named = [...key.querySelectorAll('li')].map((item) => item.textContent);
  expect(named).toEqual(['■Ship', '•Miss', '✕Hit', '✖Sunk']);
  expect(key.getAttribute('aria-label')).toBe('Key');
  cleanup();
  board(null);
  expect(byTestId('board-key').textContent).not.toContain('Ship');
});

// regression: battleship-phone-grid-pushed-down — on a phone the turn line,
// the opponent's strip and the fleet switch stacked above the grid, pushing
// its targets about 400px down the screen. The grid leads its pair and the
// switch to the other fleet follows it, so the grid starts a row higher.
test('on a phone the switch to the other fleet follows the grid', () => {
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition(['a1:hit'])}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={FLEET}
      hand={null}
      committed={[]}
      commitment={null}
      testId="board"
      onAction={() => undefined}
    />
  ));
  const pair = byTestId('board-view');
  const row = pair.querySelector('[data-switch-placement]');
  expect(row?.getAttribute('data-switch-placement')).toBe('below');
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/paired-panels/paired-panels.module.css'
    ),
    'utf8'
  );
  expect(css).toMatch(
    /\.pair\[data-switch-placement="below"\] > \.switch \{\s*order: 1;/
  );
});

// regression: battleship-phone-switch-full-width — on a phone the Your
// fleet / Targeting switch under the grid was a bar as wide as the grid,
// as heavy as the targets above it. The switch that follows its panel is a
// compact control centred under it.
test('on a phone the switch under the grid is a compact control, centred', () => {
  const css = readFileSync(
    join(
      import.meta.dirname,
      '../../../pkgs/ui-root-client-ts/src/paired-panels/paired-panels.module.css'
    ),
    'utf8'
  );
  expect(css).toMatch(
    /\.pair\[data-switch-placement="below"\] > \.switch \{\s*order: 1;\s*justify-self: center;\s*width: min\(100%, 18rem\);/
  );
});
