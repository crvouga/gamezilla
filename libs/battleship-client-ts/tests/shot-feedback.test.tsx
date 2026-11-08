import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

const fleet =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';

// regression: battleship-pending-shot-has-no-feedback
test('J10 submission shows a busy action until the existing refusal reset permits retry', () => {
  const [syncKey, reset] = createSignal(0);
  const actions: string[] = [];
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition([])}
      orientation="white"
      interactive
      sound={false}
      syncKey={syncKey()}
      setup={fleet}
      hand={null}
      committed={[]}
      commitment={null}
      testId="feedback"
      onAction={(cell) => actions.push(cell)}
    />
  ));
  fireEvent.click(byTestId('feedback-area-9'));
  fireEvent.click(byTestId('feedback-aim-j10'));
  fireEvent.click(byTestId('feedback-fire'));
  expect(byTestId('feedback-fire').getAttribute('aria-busy')).toBe('true');
  expect(byTestId('feedback-fire').textContent).toContain('Firing at J10');
  fireEvent.click(byTestId('feedback-aim-i10'));
  expect(byTestId('feedback-fire').textContent).toContain('Firing at J10');
  fireEvent.click(byTestId('feedback-fire'));
  expect(actions).toEqual(['j10']);
  reset(1);
  expect(byTestId('feedback-fire').hasAttribute('aria-busy')).toBe(false);
  expect(byTestId('feedback-fire').textContent).toContain(
    'Choose a cell in F9–J10'
  );
  fireEvent.click(byTestId('feedback-aim-j10'));
  fireEvent.click(byTestId('feedback-fire'));
  expect(actions).toEqual(['j10', 'j10']);
});

// regression: battleship-spectator-asked-to-aim
test('a spectator inspects Red waters without being told to aim or fire', () => {
  const actions: string[] = [];
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition(['f10:hit', 'a2:miss'])}
      orientation="white"
      interactive={false}
      sound={false}
      syncKey={0}
      setup={null}
      hand={null}
      committed={[]}
      commitment={null}
      testId="watch"
      onAction={(cell) => actions.push(cell)}
    />
  ));
  fireEvent.click(byTestId('watch-view-target'));
  fireEvent.click(byTestId('watch-area-9'));
  expect(byTestId('watch-target-tools').textContent).toContain(
    'Inspect cells: F9–J10'
  );
  expect(byTestId('watch-aim-grid').getAttribute('aria-label')).toBe(
    'Shot details'
  );
  expect(byTestId('watch-aim-f10').getAttribute('aria-label')).toContain('hit');
  fireEvent.click(byTestId('watch-aim-f10'));
  expect(actions).toEqual([]);
  expect(document.querySelector('[data-testid="watch-fire"]')).toBeNull();
});
