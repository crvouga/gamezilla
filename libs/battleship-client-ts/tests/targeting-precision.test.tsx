import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

const fleet =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';

function mount() {
  const actions: string[] = [];
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
      testId="precision"
      onAction={(cell) => actions.push(cell)}
    />
  ));
  return actions;
}

test('a mistaken edge target can be corrected before spending the shot', () => {
  // regression: battleship-touch-spends-mistarget
  // regression: battleship-confirmation-label-empty
  const actions = mount();
  fireEvent.click(byTestId('precision-target-j9'));
  expect(actions).toEqual([]);
  fireEvent.click(byTestId('precision-target-j10'));
  expect(byTestId('precision-fire').textContent).toContain('Fire at J10');
  fireEvent.click(byTestId('precision-view-own'));
  fireEvent.click(byTestId('precision-view-target'));
  expect(byTestId('precision-fire').textContent).toContain('Fire at J10');
  fireEvent.click(byTestId('precision-fire'));
  expect(actions).toEqual(['j10']);
});

test('keyboard selection previews a shot before confirmation', async () => {
  const actions = mount();
  const cell = byTestId('precision-target-a1');
  cell.focus();
  const user = userEvent.setup({ delay: null });
  await user.keyboard('{Enter}');
  expect(actions).toEqual([]);
  expect(byTestId('precision-fire').textContent).toContain('Fire at A1');
  for (
    let step = 0;
    step < 6 && document.activeElement !== byTestId('precision-fire');
    step += 1
  )
    await user.tab();
  expect(document.activeElement).toBe(byTestId('precision-fire'));
  await user.keyboard('{Enter}');
  expect(actions).toEqual(['a1']);
});

// regression: battleship-aim-cleared-by-unchanged-position
test('a refreshed game record preserves the selected target when its position is unchanged', () => {
  const position = encodeBattleshipPosition([]);
  const [record, setRecord] = createSignal({ position, syncKey: 0 });
  const actions: string[] = [];
  renderBoard(() => (
    <BattleshipBoard
      position={record().position}
      orientation="white"
      interactive
      sound={false}
      syncKey={record().syncKey}
      setup={fleet}
      hand={null}
      committed={[]}
      commitment={null}
      testId="refresh"
      onAction={(cell) => actions.push(cell)}
    />
  ));
  fireEvent.click(byTestId('refresh-target-f10'));
  setRecord({ position, syncKey: 0 });
  expect(byTestId('refresh-fire').textContent).toContain('Fire at F10');
  fireEvent.click(byTestId('refresh-fire'));
  expect(actions).toEqual(['f10']);
  setRecord({ position, syncKey: 1 });
  expect(byTestId('refresh-fire').textContent).toContain('Choose a target');
});
