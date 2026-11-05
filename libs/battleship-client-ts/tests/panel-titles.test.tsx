/** @jsxImportSource solid-js */
/** Each board is named once: by the switch above it, or its own title side by side. */
import { afterEach, expect, test } from 'bun:test';
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
