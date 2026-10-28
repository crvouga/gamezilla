import { expect, test } from 'bun:test';
import { WordTilesBoard } from '@libs/word-tiles-client-ts/word-tiles-board';
import {
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { IdProvider } from '@pkgs/uuid-client-ts/solid';
import { fireEvent } from '@solidjs/testing-library';

const START = encodePosition(newPosition(2, 'enable1.90ef7a729517'));

function board(hand: string | null, interactive = true) {
  const actions: string[] = [];
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <IdProvider createId={() => 'id'} random={() => 0.5}>
        <ThemeProvider colorScheme="light">
          <WordTilesBoard
            position={START}
            orientation="white"
            interactive={interactive}
            sound={false}
            syncKey={0}
            testId="wt"
            setup={null}
            hand={hand}
            committed={[]}
            commitment={null}
            onAction={(action) => actions.push(action)}
          />
        </ThemeProvider>
      </IdProvider>
    </ClockProvider>
  ));
  return { view, actions };
}

test('placing tiles from the rack and playing sends one proposal', () => {
  const { view, actions } = board('11,0,82,98,25,77,69');
  for (const [tile, cell] of [
    ['11', 'g8'],
    ['0', 'h8'],
    ['82', 'i8'],
  ] as const) {
    fireEvent.click(view.getByTestId(`wt-rack-${tile}`));
    fireEvent.click(view.getByTestId(`wt-cell-${cell}`));
  }
  expect(view.getByTestId('wt-cell-h8').getAttribute('data-state')).toBe(
    'tentative'
  );
  expect(view.getByTestId('wt-status').textContent).toContain('10');
  fireEvent.click(view.getByTestId('wt-submit'));
  expect(actions).toEqual(['play:g8=11.h8=0.i8=82']);
});

test('a placement the rules refuse cannot be played and says why', () => {
  const { view, actions } = board('11,0,82,98,25,77,69');
  fireEvent.click(view.getByTestId('wt-rack-11'));
  fireEvent.click(view.getByTestId('wt-cell-a1'));
  fireEvent.click(view.getByTestId('wt-rack-0'));
  fireEvent.click(view.getByTestId('wt-cell-b1'));
  expect(view.getByTestId('wt-status').textContent).toContain('centre');
  expect(view.getByTestId('wt-submit').hasAttribute('disabled')).toBe(true);
  expect(actions).toEqual([]);
});

test('a watcher sees the board but no rack', () => {
  const { view } = board(null, false);
  expect(view.queryByTestId('wt-rack')).toBeNull();
  expect(view.getByTestId('wt-bag').textContent).toContain('86');
});

test('passing is one tap', () => {
  const { view, actions } = board('11,0,82,98,25,77,69');
  fireEvent.click(view.getByTestId('wt-pass'));
  expect(actions).toEqual(['pass']);
});
