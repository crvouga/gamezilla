import { expect, test } from 'bun:test';
import {
  createWordTilesBoard,
  WordTilesBoard,
} from '@libs/word-tiles-client-ts/word-tiles-board';
import { wordTilesFrame } from '@libs/word-tiles-client-ts/word-tiles-frame';
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

test('a watcher sees the board but no rack, actions or preview', () => {
  const { view } = board(null, false);
  expect(view.getByTestId('wt-cell-h8')).not.toBeNull();
  expect(view.queryByTestId('wt-rack')).toBeNull();
  expect(view.queryByTestId('wt-pass')).toBeNull();
  expect(view.queryByTestId('wt-preview')).toBeNull();
});

test('the frame shows the turn, the bag, each score and each rack', () => {
  const frame = wordTilesFrame(2);
  expect(frame.turnStatus(START, null, [])).toContain('86 tiles in the bag');
  expect(frame.seats.stat(START, 'black')).toEqual({
    label: 'Score',
    value: '0',
  });
  expect(frame.seats.facts(START, 'white', [])).toEqual(['7 tiles']);
});

test('the board, its actions and its controls share one draft', () => {
  const actions: string[] = [];
  const { clock, timers } = createHarnessClock();
  let ids: () => string[] = () => [];
  let run: (id: string) => void = () => undefined;
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <IdProvider createId={() => 'id'} random={() => 0.5}>
        <ThemeProvider colorScheme="light">
          {(() => {
            const session = createWordTilesBoard({
              position: START,
              orientation: 'white',
              interactive: true,
              sound: false,
              syncKey: 0,
              testId: 'custom-game-board',
              setup: null,
              hand: '11,0,82,98,25,77,69',
              committed: [],
              commitment: null,
              onAction: (action) => actions.push(action),
            });
            const enabled = () =>
              session
                .actions()
                .filter((action) => action.enabled)
                .map((action) => action.id);
            ids = enabled;
            run = (id) =>
              session
                .actions()
                .find((action) => action.id === id)
                ?.run();
            return (
              <>
                <session.Board />
                <session.controls />
              </>
            );
          })()}
        </ThemeProvider>
      </IdProvider>
    </ClockProvider>
  ));
  expect(ids()).not.toContain('submit');
  expect(ids()).not.toContain('recall');
  fireEvent.click(view.getByTestId('custom-game-board-rack-11'));
  fireEvent.click(view.getByTestId('custom-game-board-cell-h8'));
  expect(ids()).toContain('recall');
  expect(view.getByTestId('custom-game-board-preview')).not.toBeNull();
  run('recall');
  expect(
    view.getByTestId('custom-game-board-cell-h8').getAttribute('data-state')
  ).not.toBe('tentative');
  run('exchange');
  expect(ids()).toContain('exchange-cancel');
  fireEvent.click(view.getByTestId('custom-game-board-rack-11'));
  run('exchange-confirm');
  expect(actions).toEqual(['swap:11']);
});

test('passing is one tap', () => {
  const { view, actions } = board('11,0,82,98,25,77,69');
  fireEvent.click(view.getByTestId('wt-pass'));
  expect(actions).toEqual(['pass']);
});
