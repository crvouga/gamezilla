/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { battleshipFrame } from '@libs/battleship-client-ts/battleship-frame';
import { CELLS } from '@libs/battleship-shared-ts/battleship-board';
import { acceptFleet } from '@libs/battleship-shared-ts/battleship-fleet';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

/** Blue (white) hits a1 then sinks a destroyer at b1; Red misses e5 then hits c3. */
const POSITION = encodeBattleshipPosition([
  'a1:hit',
  'e5:miss',
  'b1:sunk:destroyer',
  'c3:hit',
]);
const FLEET =
  'fleet:carrier@c3h;battleship@a5h;cruiser@a7h;submarine@a9h;destroyer@j1v';

function board(options: {
  setup: string | null;
  orientation?: GameSide;
  interactive?: boolean;
  position?: string;
}) {
  const [position, setPosition] = createSignal(options.position ?? POSITION);
  const actions: string[] = [];
  renderBoard(() => (
    <BattleshipBoard
      position={position()}
      orientation={options.orientation ?? 'white'}
      interactive={options.interactive ?? false}
      sound={false}
      syncKey={0}
      setup={options.setup}
      hand={null}
      committed={[]}
      commitment={null}
      testId="board"
      onAction={(action) => actions.push(action)}
    />
  ));
  return { actions, setPosition };
}
const own = (cell: string) => byTestId(`board-own-${cell}`);
const target = (cell: string) => byTestId(`board-target-${cell}`);

test('the own grid shows the viewer’s fleet from its setup and the shots fired at it', () => {
  expect(acceptFleet(FLEET)).toBe(FLEET);
  board({ setup: FLEET });
  expect(own('c3').getAttribute('data-tone')).toBe('alert');
  expect(own('c3').textContent).toBe('✕');
  expect(own('c3').getAttribute('aria-label')).toBe(
    'C3: your Carrier, hit, latest shot'
  );
  expect(own('c3').getAttribute('data-emphasis')).toBe('recent');
  expect(own('d3').getAttribute('data-tone')).toBe('occupied');
  expect(own('d3').getAttribute('aria-label')).toBe('D3: your Carrier');
  expect(own('e5').getAttribute('data-tone')).toBe('quiet');
  expect(own('e5').textContent).toBe('•');
  expect(own('e5').getAttribute('aria-label')).toBe('E5: open water, missed');
  expect(own('a1').getAttribute('data-tone')).toBe('open');
});

test('the targeting grid shows only the public shots, never a ship that was not hit', () => {
  board({ setup: FLEET });
  const fired = new Set(['a1', 'b1']);
  for (const cell of CELLS) {
    const element = target(cell);
    if (fired.has(cell)) continue;
    expect(element.getAttribute('data-tone')).toBe('open');
    expect(element.textContent).toBe('');
    expect(element.getAttribute('aria-label')).toBe(
      `${cell.toUpperCase()}: not fired at`
    );
  }
  const grid = byTestId('board-target-grid');
  expect(grid.querySelectorAll('[data-tone="occupied"]')).toHaveLength(0);
  expect(grid.textContent).not.toContain('■');
  // The sunk destroyer is outlined on both cells the shots credit it with.
  for (const cell of ['a1', 'b1']) {
    expect(target(cell).getAttribute('data-tone')).toBe('critical');
    expect(target(cell).getAttribute('data-outlined')).toBe('true');
    expect(target(cell).textContent).toBe('✖');
  }
  expect(target('b1').getAttribute('aria-label')).toBe(
    'B1: hit, sunk Destroyer, latest shot'
  );
  // The ships each fleet has lost are its seat's facts, not the board's.
  expect(byTestId('board').textContent).not.toContain('Destroyer sunk');
  expect(battleshipFrame.seats.facts(POSITION, 'black', [])).toEqual([
    'Destroyer sunk',
  ]);
  expect(battleshipFrame.seats.facts(POSITION, 'white', [])).toEqual([]);
});

test('interactive targets fire through onAction and wait, aiming, for the outcome', () => {
  const view = board({ setup: FLEET, interactive: true });
  expect(byTestId('board-view').getAttribute('data-selected')).toBe('target');
  expect(target('e5').getAttribute('aria-disabled')).toBe('false');
  expect(target('e5').getAttribute('aria-label')).toBe('Fire at E5');
  expect(target('a1').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(target('a1'));
  expect(view.actions).toEqual([]);
  fireEvent.click(target('e5'));
  expect(view.actions).toEqual(['e5']);
  expect(target('e5').getAttribute('data-emphasis')).toBe('pending');
  expect(target('e5').getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(target('e5'));
  expect(view.actions).toEqual(['e5']);
  view.setPosition(
    encodeBattleshipPosition([
      'a1:hit',
      'e5:miss',
      'b1:sunk:destroyer',
      'c3:hit',
      'e5:miss',
    ])
  );
  expect(target('e5').getAttribute('data-emphasis')).toBe('recent');
  expect(target('e5').getAttribute('data-tone')).toBe('quiet');
});

test('read-only boards refuse every target, and the switch keeps both grids mounted', () => {
  const view = board({ setup: FLEET });
  expect(byTestId('board-view').getAttribute('data-selected')).toBe('own');
  const before = target('e5');
  expect(before.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(before);
  expect(view.actions).toEqual([]);
  fireEvent.click(byTestId('board-view-target'));
  expect(byTestId('board-view').getAttribute('data-selected')).toBe('target');
  expect(target('e5')).toBe(before);
  fireEvent.click(byTestId('board-view-own'));
  expect(byTestId('board-view').getAttribute('data-selected')).toBe('own');
});

test("the frame's turn line announces the latest shot and whose turn it is", () => {
  board({ setup: FLEET });
  expect(document.querySelector('[data-testid="board-status"]')).toBeNull();
  expect(battleshipFrame.turnStatus(POSITION, 'white', [])).toBe(
    'Red fleet fired at C3 and hit. Your turn to fire.'
  );
});

test('the other side sees its own fleet and shots from its orientation', () => {
  board({
    setup:
      'fleet:carrier@a3h;battleship@a5h;cruiser@a7h;submarine@a9h;destroyer@a1h',
    orientation: 'black',
  });
  expect(own('a1').getAttribute('aria-label')).toBe('A1: your Destroyer, sunk');
  expect(own('b1').getAttribute('data-tone')).toBe('critical');
  expect(own('b1').getAttribute('data-emphasis')).toBe('recent');
  expect(own('a3').getAttribute('aria-label')).toBe('A3: your Carrier');
  expect(target('c3').getAttribute('data-tone')).toBe('alert');
  expect(target('e5').getAttribute('data-tone')).toBe('quiet');
  expect(battleshipFrame.turnStatus(POSITION, 'black', [])).toBe(
    'You fired at C3 and hit. Blue fleet is firing.'
  );
});

test('a watcher sees two public shot boards named by side, with no ships', () => {
  board({ setup: null });
  expect(byTestId('board-own-grid').getAttribute('aria-label')).toBe(
    'Blue fleet waters'
  );
  expect(byTestId('board-target-grid').getAttribute('aria-label')).toBe(
    'Red fleet waters'
  );
  expect(document.querySelectorAll('[data-tone="occupied"]')).toHaveLength(0);
  expect(own('c3').getAttribute('aria-label')).toBe('C3: hit, latest shot');
  expect(own('d3').getAttribute('data-tone')).toBe('open');
  expect(battleshipFrame.turnStatus(POSITION, null, [])).toBe(
    'Red fleet fired at C3 and hit. Blue fleet to fire.'
  );
});
