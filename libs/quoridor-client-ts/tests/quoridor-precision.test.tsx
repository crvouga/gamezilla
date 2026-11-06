import { expect, test } from 'bun:test';
import { createQuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import { quoridorBoardCells } from '@libs/quoridor-client-ts/quoridor-board-cells';
import {
  encodeQuoridor,
  newQuoridor,
  playQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

function mountBoard() {
  const { clock, timers } = createHarnessClock();
  const [game, setGame] = createSignal(newQuoridor('classic'));
  const actions: string[] = [];
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <SurfaceStackProvider>
          {createQuoridorBoard({
            get position() {
              return encodeQuoridor(game());
            },
            orientation: 'white',
            interactive: true,
            sound: false,
            syncKey: 0,
            setup: null,
            hand: null,
            committed: [],
            commitment: null,
            testId: 'precision',
            onAction: (action) => {
              actions.push(action);
              const next = playQuoridor(game(), action);
              if (next) setGame(next);
            },
          }).Board()}
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return { view, actions };
}

test('opening destinations and d4 wall anchor have precise coordinate choices', async () => {
  // regression: quoridor-phone-precise-targets
  const { view, actions } = mountBoard();
  fireEvent.click(view.getByTestId('precision-precise-target'));
  fireEvent.click(await view.findByTestId('precision-precise-e2'));
  expect(actions).toEqual(['e2']);
  fireEvent.click(view.getByTestId('precision-mode-h'));
  fireEvent.click(view.getByTestId('precision-precise-target'));
  fireEvent.click(await view.findByTestId('precision-precise-d4'));
  expect(actions).toEqual(['e2']);
  expect(
    view
      .getByTestId('precision-action-d4h')
      .getAttribute('data-preview-edge-top')
  ).toBe('true');
  fireEvent.click(view.getByTestId('precision-wall-cancel'));
  expect(actions).toEqual(['e2']);
  fireEvent.click(view.getByTestId('precision-precise-target'));
  fireEvent.click(await view.findByTestId('precision-precise-d4'));
  fireEvent.click(view.getByTestId('precision-wall-commit'));
  expect(actions).toEqual(['e2', 'd4h']);
  expect(
    view.getByTestId('precision-action-d4h').getAttribute('data-edge-top')
  ).toBe('true');
  view.unmount();
});

test('wall modes, target and confirmation share the working board container', () => {
  // regression: quoridor-detached-wall-controls
  const { view } = mountBoard();
  const board = view.getByTestId('precision');
  expect(board.previousElementSibling).toBe(
    view.getByTestId('precision-tools')
  );
  expect(
    board.nextElementSibling?.contains(
      view.getByTestId('precision-precise-target')
    )
  ).toBe(true);
  fireEvent.click(view.getByTestId('precision-mode-h'));
  fireEvent.click(view.getByTestId('precision-action-d4h'));
  const commit = view.getByTestId('precision-wall-commit');
  expect(commit.parentElement?.parentElement).toBe(board.parentElement);
  expect(view.getAllByTestId('precision-mode-h')).toHaveLength(1);
  view.unmount();
});

test('Classic goal row and Hill center do not use the heavy physical outline', () => {
  // regression: quoridor-goal-resembles-wall
  for (const mode of ['classic', 'hill'] as const) {
    const game = playQuoridor(newQuoridor(mode), 'd4h')!;
    const cells = quoridorBoardCells(game, 'move', true, null);
    const goals = cells.filter((cell) => cell.goal);
    expect(goals).toHaveLength(mode === 'classic' ? 9 : 1);
    expect(goals.every((cell) => cell.outlined === false)).toBe(true);
    expect(cells.find((cell) => cell.id === 'd4')?.edges).toContain('top');
  }
});
