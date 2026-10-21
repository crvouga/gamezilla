/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { BattleshipSetupBoard } from '@libs/battleship-client/battleship-setup-board';
import { acceptFleet } from '@libs/battleship-shared/battleship-fleet';
import { fireEvent } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

function setupBoard(initial = '', locked = false) {
  const [setup, setSetup] = createSignal(initial);
  const changes: string[] = [];
  renderBoard(() => (
    <BattleshipSetupBoard
      setup={setup()}
      side="white"
      locked={locked}
      testId="setup"
      onChange={(next) => {
        changes.push(next);
        setSetup(next);
      }}
    />
  ));
  return { setup, changes };
}
const cell = (id: string) => byTestId(`setup-cell-${id}`);
const tone = (id: string) => cell(id).getAttribute('data-tone');

test('pressing a cell places the selected ship with its bow there, across by default', () => {
  const board = setupBoard();
  expect(byTestId('setup-progress').textContent).toContain(
    '0 of 5 ships placed'
  );
  fireEvent.click(cell('a1'));
  expect(board.setup()).toBe('fleet:carrier@a1h');
  for (const id of ['a1', 'b1', 'c1', 'd1', 'e1'])
    expect(tone(id)).toBe('occupied');
  expect(tone('f1')).toBe('open');
  expect(cell('a1').getAttribute('aria-label')).toBe('A1: Carrier');
  expect(cell('a1').textContent).toBe('■');
  expect(byTestId('setup-progress').textContent).toContain(
    '1 of 5 ships placed'
  );
  expect(byTestId('setup-progress').getAttribute('aria-live')).toBe('polite');
});

test('rotate turns the next placement down, and the five ships make the canonical fleet', () => {
  const board = setupBoard();
  fireEvent.click(cell('a1'));
  fireEvent.click(byTestId('setup-rotate'));
  expect(byTestId('setup-rotate').textContent).toContain('down');
  fireEvent.click(cell('a3'));
  expect(board.setup()).toBe('fleet:carrier@a1h;battleship@a3v');
  fireEvent.click(cell('c3'));
  fireEvent.click(cell('e3'));
  fireEvent.click(cell('g3'));
  expect(board.setup()).toBe(
    'fleet:carrier@a1h;battleship@a3v;cruiser@c3v;submarine@e3v;destroyer@g3v'
  );
  expect(acceptFleet(board.setup())).toBe(board.setup());
  expect(byTestId('setup-progress').textContent).toBe(
    'All five ships placed. Your fleet is ready.'
  );
});

test('an overlapping placement is refused with its reason and leaves the fleet unchanged', () => {
  const board = setupBoard('fleet:carrier@a1h');
  fireEvent.click(cell('c1'));
  expect(board.setup()).toBe('fleet:carrier@a1h');
  expect(board.changes).toEqual([]);
  const refusal = byTestId('setup-refusal');
  expect(refusal.getAttribute('role')).toBe('alert');
  expect(refusal.textContent).toContain(
    'The Battleship cannot go there: it would overlap the Carrier.'
  );
});

test('an out-of-bounds placement is refused and leaves the fleet unchanged', () => {
  const board = setupBoard();
  fireEvent.click(cell('h1'));
  expect(board.setup()).toBe('');
  expect(board.changes).toEqual([]);
  expect(byTestId('setup-refusal').textContent).toContain(
    'it would run off the board'
  );
  fireEvent.click(cell('f1'));
  expect(board.setup()).toBe('fleet:carrier@f1h');
  expect(document.querySelector('[data-testid="setup-refusal"]')).toBeNull();
});

test('the preview marks the cells a placement would cover, and which it cannot', () => {
  setupBoard();
  fireEvent.focus(cell('b2'));
  for (const id of ['b2', 'c2', 'd2', 'e2', 'f2']) {
    expect(cell(id).getAttribute('data-emphasis')).toBe('preview');
    expect(cell(id).textContent).toBe('+');
  }
  fireEvent.focus(cell('h2'));
  for (const id of ['h2', 'i2', 'j2']) {
    expect(cell(id).getAttribute('data-emphasis')).toBe('refused');
    expect(cell(id).textContent).toBe('⊘');
  }
  expect(cell('b2').getAttribute('data-emphasis')).toBe('none');
});

test('placing a placed ship again moves it; rotating it in place is refused off the board', () => {
  const board = setupBoard('fleet:carrier@a1h;battleship@a3h');
  fireEvent.click(byTestId('setup-ship-carrier'));
  fireEvent.click(cell('a5'));
  expect(board.setup()).toBe('fleet:carrier@a5h;battleship@a3h');
  fireEvent.click(byTestId('setup-ship-carrier'));
  fireEvent.click(byTestId('setup-rotate'));
  expect(board.setup()).toBe('fleet:carrier@a5v;battleship@a3h');
  fireEvent.click(cell('a8'));
  expect(board.setup()).toBe('fleet:carrier@a5v;battleship@a3h');
  expect(byTestId('setup-refusal').textContent).toContain('run off the board');
  fireEvent.click(byTestId('setup-remove'));
  expect(board.setup()).toBe('fleet:battleship@a3h');
});

test('the keyboard selects a cell with arrows, rotates with R and places with Enter', async () => {
  const user = userEvent.setup();
  const board = setupBoard();
  const first = cell('a1');
  expect(first.tabIndex).toBe(0);
  expect(cell('b1').tabIndex).toBe(-1);
  first.focus();
  fireEvent.keyDown(first, { key: 'ArrowDown' });
  expect(document.activeElement).toBe(cell('a2'));
  fireEvent.keyDown(cell('a2'), { key: 'ArrowRight' });
  expect(document.activeElement).toBe(cell('b2'));
  expect(cell('b2').tabIndex).toBe(0);
  fireEvent.keyDown(cell('b2'), { key: 'r' });
  expect(byTestId('setup-rotate').textContent).toContain('down');
  fireEvent.keyDown(cell('b2'), { key: 'End' });
  expect(document.activeElement).toBe(cell('j2'));
  fireEvent.keyDown(cell('j2'), { key: 'Home' });
  expect(document.activeElement).toBe(cell('a2'));
  await user.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(cell('b2'));
  await user.keyboard('{Enter}');
  expect(board.setup()).toBe('fleet:carrier@b2v');
  expect(document.activeElement).toBe(cell('b2'));
  await user.keyboard('{ArrowRight}{ArrowRight}{r}{Enter}');
  expect(board.setup()).toBe('fleet:carrier@b2v;battleship@d2h');
});

test('a locked setup disables every control and says why', () => {
  const board = setupBoard('fleet:carrier@a1h', true);
  expect(byTestId('setup-locked').textContent).toContain('locked in');
  expect(cell('a5').getAttribute('aria-disabled')).toBe('true');
  expect(byTestId('setup-rotate').hasAttribute('disabled')).toBe(true);
  expect(
    (byTestId('setup-ship-battleship') as HTMLInputElement).closest('fieldset')
      ?.disabled
  ).toBe(true);
  fireEvent.click(cell('a5'));
  fireEvent.keyDown(cell('a5'), { key: 'r' });
  expect(board.setup()).toBe('fleet:carrier@a1h');
  expect(board.changes).toEqual([]);
});

test("the placing progress has its own id, leaving `<testId>-status` to the screen's private-setup status", () => {
  // regression: battleship-setup-status-test-id-collision
  setupBoard();
  expect(document.querySelector('[data-testid="setup-status"]')).toBeNull();
  expect(byTestId('setup-progress').getAttribute('role')).toBe('status');
});
