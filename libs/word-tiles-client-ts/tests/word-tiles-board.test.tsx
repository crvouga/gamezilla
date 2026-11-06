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

function board(hand: string | null, interactive = true, position = START) {
  const actions: string[] = [];
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <IdProvider createId={() => 'id'} random={() => 0.5}>
        <ThemeProvider colorScheme="light">
          <WordTilesBoard
            position={position}
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
  expect(frame.turnStatus(START, null, [], () => null)).toContain(
    '86 tiles in the bag'
  );
  expect(frame.seats.stat(START, 'black')).toEqual({
    label: 'Score',
    value: '0',
  });
  expect(frame.seats.facts(START, 'white', [])).toEqual(['7 tiles']);
});

test('the board, its actions and its controls share one draft', () => {
  const actions: string[] = [];
  const { clock, timers } = createHarnessClock();
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
  fireEvent.click(view.getByTestId('custom-game-board-more'));
  expect(
    view.getByTestId('custom-game-board-recall').hasAttribute('disabled')
  ).toBe(true);
  fireEvent.click(view.getByTestId('custom-game-board-rack-11'));
  fireEvent.click(view.getByTestId('custom-game-board-cell-h8'));
  expect(
    view.getByTestId('custom-game-board-recall').hasAttribute('disabled')
  ).toBe(false);
  expect(view.getByTestId('custom-game-board-preview')).not.toBeNull();
  fireEvent.click(view.getByTestId('custom-game-board-recall'));
  expect(
    view.getByTestId('custom-game-board-cell-h8').getAttribute('data-state')
  ).not.toBe('tentative');
  fireEvent.click(view.getByTestId('custom-game-board-more'));
  fireEvent.click(view.getByTestId('custom-game-board-exchange'));
  expect(view.getByTestId('custom-game-board-exchange-cancel')).not.toBeNull();
  fireEvent.click(view.getByTestId('custom-game-board-rack-11'));
  expect(view.queryByTestId('custom-game-board-submit')).toBeNull();
  fireEvent.click(view.getByTestId('custom-game-board-exchange-confirm'));
  expect(actions).toEqual(['swap:11']);
});

test('passing is available through more actions', () => {
  const { view, actions } = board('11,0,82,98,25,77,69');
  fireEvent.click(view.getByTestId('wt-more'));
  fireEvent.click(view.getByTestId('wt-pass'));
  expect(actions).toEqual(['pass']);
});

// regression: word-tiles-separated-turn-controls
test('CAT editing and exchange share the rack work area before the grid', () => {
  const { view } = board('11,0,82,98,25,77,69');
  const work = view
    .getByTestId('wt-submit')
    .closest('[data-component="WordTileWorkbench"]');
  fireEvent.click(view.getByTestId('wt-more'));
  for (const action of [
    'recall',
    'undo',
    'redo',
    'shuffle',
    'pass',
    'exchange',
  ]) {
    expect(work?.contains(view.getByTestId(`wt-${action}`))).toBe(true);
  }
  expect(work?.compareDocumentPosition(view.getByTestId('wt'))).toBe(4);
});

// regression: word-tiles-unreadable-no-recovery
test('wt2 unreadable input links to the public app version screen', () => {
  const { view } = board(null, false, 'wt2|not-a-position');
  const reload = view.getByRole('link', { name: 'Check app version' });
  expect(reload.getAttribute('href')).toBe('/more/about');
  expect(view.queryByTestId('wt-rack')).toBeNull();
});

// regression: word-tiles-phone-action-overload
test('literal CAT rack keeps primary exposed and secondary tools discoverable with focus recovery', () => {
  const { view } = board('11,0,82,98,25,77,69');
  const more = view.getByRole('button', { name: 'More actions' });
  expect(more.getAttribute('aria-expanded')).toBe('false');
  expect(view.queryByTestId('wt-recall')).toBeNull();
  expect(view.getByTestId('wt-submit')).not.toBeNull();
  fireEvent.click(view.getByTestId('wt-rack-11'));
  fireEvent.click(view.getByTestId('wt-cell-h8'));
  fireEvent.click(more);
  expect(more.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(view.getByTestId('wt-recall'));
  expect(view.getByTestId('wt-cell-h8').getAttribute('data-state')).toBe(
    'empty'
  );
  expect(more.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(more);
  fireEvent.click(more);
  fireEvent.click(view.getByTestId('wt-undo'));
  expect(view.getByTestId('wt-cell-h8').getAttribute('data-state')).toBe(
    'tentative'
  );
  fireEvent.click(more);
  fireEvent.keyDown(view.getByTestId('wt-redo'), { key: 'Escape' });
  expect(more.getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(more);
});
