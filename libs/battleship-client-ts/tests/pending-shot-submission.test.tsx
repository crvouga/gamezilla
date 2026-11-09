import { expect, test } from 'bun:test';
import { BattleshipBoard } from '@libs/battleship-client-ts/battleship-board';
import { encodeBattleshipPosition } from '@libs/battleship-shared-ts/battleship-position';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

const fleet =
  'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';

// regression: battleship-submitting-shot-loses-feedback — the frame makes the
// board non-interactive while a move is submitting (customGameCanMove), which
// hid the busy "Firing at J10" control and relabelled the cells for a
// spectator ("Inspect cells").
test('while the frame submits J10 the busy Fire stays and the cells are not offered for inspection', () => {
  const [interactive, setInteractive] = createSignal(true);
  const [syncKey, reset] = createSignal(0);
  const actions: string[] = [];
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition([])}
      orientation="white"
      interactive={interactive()}
      sound={false}
      syncKey={syncKey()}
      setup={fleet}
      hand={null}
      committed={[]}
      commitment={null}
      testId="sending"
      onAction={(cell) => {
        actions.push(cell);
        setInteractive(false);
      }}
    />
  ));
  fireEvent.click(byTestId('sending-area-9'));
  fireEvent.click(byTestId('sending-aim-j10'));
  fireEvent.click(byTestId('sending-fire'));
  expect(actions).toEqual(['j10']);
  const fire = byTestId('sending-fire');
  expect(fire.getAttribute('aria-busy')).toBe('true');
  expect(fire.textContent).toContain('Firing at J10');
  expect(byTestId('sending-target-tools').textContent).not.toContain('Inspect');
  // A refusal resets the aim through the existing resync; play resumes.
  setInteractive(true);
  reset(1);
  expect(byTestId('sending-fire').hasAttribute('aria-busy')).toBe(false);
  expect(byTestId('sending-fire').textContent).toContain('Choose a cell in');
});

test('a viewer who cannot act, with no shot pending, still inspects', () => {
  renderBoard(() => (
    <BattleshipBoard
      position={encodeBattleshipPosition(['a1:miss'])}
      orientation="white"
      interactive={false}
      sound={false}
      syncKey={0}
      setup={fleet}
      hand={null}
      committed={[]}
      commitment={null}
      testId="waiting"
      onAction={() => undefined}
    />
  ));
  fireEvent.click(byTestId('waiting-view-target'));
  expect(byTestId('waiting-target-tools').textContent).toContain(
    'Inspect cells'
  );
  expect(document.querySelector('[data-testid="waiting-fire"]')).toBeNull();
});
