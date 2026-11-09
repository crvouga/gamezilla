import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { fireEvent } from '@solidjs/testing-library';
import { byTestId, renderBoard } from './render';

const fleet =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';

// regression: battleship-desktop-aims-in-two-steps — on a wide screen, where
// the whole board's cells are large, aiming still took a region, then a cell
// in a zoomed panel, then Fire. A wide screen aims at the whole board.
test('on a wide screen a cell of the whole board is aimed at directly', () => {
  const actions: string[] = [];
  renderBoard(
    () => (
      <BattleshipBoard
        position={encodeBattleshipPosition([])}
        orientation="white"
        interactive
        sound={false}
        syncKey={0}
        setup={fleet}
        hand={null}
        committed={[]}
        commitment={null}
        testId="wide"
        onAction={(cell) => actions.push(cell)}
      />
    ),
    1440
  );
  expect(document.querySelector('[data-testid="wide-area-0"]')).toBeNull();
  expect(document.querySelector('[data-testid="wide-aim-grid"]')).toBeNull();
  expect(byTestId('wide-fire').textContent).toContain('Choose a cell');
  fireEvent.click(byTestId('wide-target-j10'));
  expect(byTestId('wide-target-j10').getAttribute('data-emphasis')).toBe(
    'preview'
  );
  expect(byTestId('wide-fire').textContent).toContain('Fire at J10');
  fireEvent.click(byTestId('wide-fire'));
  expect(actions).toEqual(['j10']);
});

test('on a phone aiming keeps the region workbench', () => {
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition([])}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={fleet}
      hand={null}
      committed={[]}
      commitment={null}
      testId="phone"
      onAction={() => undefined}
    />
  ));
  expect(byTestId('phone-area-9')).toBeTruthy();
  expect(byTestId('phone-fire').textContent).toContain(
    'Choose a cell in A1–E2'
  );
});
