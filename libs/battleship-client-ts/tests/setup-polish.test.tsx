import { expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client-ts/battleship-setup-board';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

function setupBoard(initial = '', locked = false) {
  const [value, setValue] = createSignal(initial);
  renderBoard(() => (
    <BattleshipSetupBoard
      setup={value()}
      side="white"
      locked={locked}
      testId="polish"
      initialPlacement="full"
      onChange={(next) => setValue(next)}
    />
  ));
  return value;
}

const removeShown = () =>
  document.querySelector('[data-testid="polish-remove"]') !== null;

// regression: battleship-remove-offered-with-nothing-placed — a disabled
// Remove sat beside Rotate on an empty board.
test('Remove is offered only for a placed ship', () => {
  const setup = setupBoard();
  expect(removeShown()).toBe(false);
  fireEvent.click(byTestId('polish-ship-carrier'));
  expect(removeShown()).toBe(false);
  fireEvent.click(byTestId('polish-cell-a1'));
  expect(setup()).toContain('carrier@a1');
  fireEvent.click(byTestId('polish-ship-carrier'));
  expect(removeShown()).toBe(true);
  fireEvent.click(byTestId('polish-remove'));
  expect(setup()).not.toContain('carrier');
});

// regression: battleship-locked-fleet-said-twice — a locked fleet said
// "All five ships placed. Your fleet is ready." and then that it was locked.
test('a locked fleet says it is locked once', () => {
  setupBoard(
    'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h',
    true
  );
  expect(byTestId('polish-locked').textContent).toContain('locked in');
  expect(document.querySelector('[data-testid="polish-progress"]')).toBeNull();
  expect(document.body.textContent).not.toContain('Your fleet is ready');
});
