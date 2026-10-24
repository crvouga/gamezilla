import { expect, test } from 'bun:test';
import { QuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import { quoridorBoardCells } from '@libs/quoridor-client-ts/quoridor-board-cells';
import {
  encodeQuoridor,
  newQuoridor,
  playQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

test('an accepted wall clears its preview instead of reporting an overlap', () => {
  // regression: quoridor-accepted-wall-preview
  const [game, setGame] = createSignal(newQuoridor('classic'));
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <QuoridorBoard
          position={encodeQuoridor(game())}
          interactive={true}
          testId="wall-preview"
          onAction={(action) => {
            const next = playQuoridor(game(), action);
            if (next !== null) setGame(next);
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  fireEvent.click(view.getByRole('button', { name: 'Horizontal wall' }));
  const anchor = view.getByTestId('wall-preview-action-a1h');
  fireEvent.focus(anchor);
  fireEvent.click(anchor);
  expect(game().walls).toEqual(['a1h']);
  expect(
    view.getByTestId('wall-preview-wall-status').textContent
  ).not.toContain('overlaps');
  view.unmount();
});

test('outside wall anchors never paint a partial wall preview', () => {
  // regression: quoridor-invalid-wall-preview
  for (const preview of ['i8h', 'i9v']) {
    const cells = quoridorBoardCells(newQuoridor('hill'), 'h', true, preview);
    expect(cells.every((cell) => cell.previewEdges?.length === 0)).toBe(true);
  }
});

test('a finished hill board never announces the next player to move', () => {
  // regression: quoridor-terminal-turn-indicator
  const game = replayQuoridor('hill', [
    'e2',
    'a4',
    'e8',
    'i4',
    'e3',
    'a3',
    'e7',
    'i3',
    'e4',
    'a2',
    'e6',
    'i2',
    'e5',
  ]);
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <QuoridorBoard
          position={encodeQuoridor(game)}
          interactive={false}
          testId="finished-hill"
          onAction={() => {
            throw new Error('Finished board must be inert');
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(view.container.textContent).not.toContain('— to move');
  view.unmount();
});
