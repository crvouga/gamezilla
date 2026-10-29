import { expect, test } from 'bun:test';
import { createQuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import { quoridorBoardCells } from '@libs/quoridor-client-ts/quoridor-board-cells';
import { quoridorFrame } from '@libs/quoridor-client-ts/quoridor-frame';
import {
  encodeQuoridor,
  newQuoridor,
  playQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameFrameBoardSession } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

/** The board's props, everything but where it is and who may play. */
const BOARD: Omit<
  GameBoardProps,
  'position' | 'interactive' | 'testId' | 'onAction'
> = {
  orientation: 'white',
  sound: false,
  syncKey: 0,
  setup: null,
  hand: null,
  committed: [],
  commitment: null,
};

/** Runs the board's action `id`, as the frame's action bar does. */
function run(session: GameFrameBoardSession<JSX.Element>, id: string): void {
  const action = session.actions().find((each) => each.id === id);
  if (action === undefined) throw new Error(`No action ${id}`);
  action.run();
}

test('an accepted wall clears its preview instead of reporting an overlap', () => {
  // regression: quoridor-accepted-wall-preview
  const [game, setGame] = createSignal(newQuoridor('classic'));
  const { clock, timers } = createHarnessClock();
  let session: GameFrameBoardSession<JSX.Element> | undefined;
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {(() => {
          session = createQuoridorBoard({
            ...BOARD,
            get position() {
              return encodeQuoridor(game());
            },
            interactive: true,
            testId: 'wall-preview',
            onAction: (action) => {
              const next = playQuoridor(game(), action);
              if (next !== null) setGame(next);
            },
          });
          return session.Board();
        })()}
      </ThemeProvider>
    </ClockProvider>
  ));
  run(session!, 'mode-h');
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

test('a finished hill game never announces the next player to move', () => {
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
  const position = encodeQuoridor(game);
  const frame = quoridorFrame(true);
  for (const viewer of [null, 'white', 'black', 'red', 'blue'] as const)
    expect(frame.turnStatus(position, viewer, [])).toBeNull();
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {(() => {
          const session = createQuoridorBoard({
            ...BOARD,
            position,
            interactive: true,
            testId: 'finished-hill',
            onAction: () => {
              throw new Error('Finished board must be inert');
            },
          });
          for (const action of session.actions())
            expect(action.enabled).toBe(false);
          return session.Board();
        })()}
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(view.container.textContent).not.toContain('to move');
  view.unmount();
});

test('the turn line names the pawn to move and where it is heading', () => {
  const classic = encodeQuoridor(newQuoridor('classic'));
  const frame = quoridorFrame(false);
  expect(frame.turnStatus(classic, 'white', [])).toBe(
    'Your turn. Reach row 9.'
  );
  expect(frame.turnStatus(classic, 'black', [])).toBe(
    'South red circle to move, heading for row 9.'
  );
  const north = encodeQuoridor(playQuoridor(newQuoridor('classic'), 'e2')!);
  expect(frame.turnStatus(north, null, [])).toBe(
    'North gold diamond to move, heading for row 1.'
  );
  expect(
    quoridorFrame(true).turnStatus(
      encodeQuoridor(newQuoridor('hill')),
      null,
      []
    )
  ).toBe('South red circle to move. First to e5 wins.');
});

test('the tools are the board’s actions, one pressed, and choosing one keeps the board', () => {
  const { clock, timers } = createHarnessClock();
  let session: GameFrameBoardSession<JSX.Element> | undefined;
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {(() => {
          session = createQuoridorBoard({
            ...BOARD,
            position: encodeQuoridor(newQuoridor('classic')),
            interactive: true,
            testId: 'tools',
            onAction: () => undefined,
          });
          return session.Board();
        })()}
      </ThemeProvider>
    </ClockProvider>
  ));
  const pressed = () =>
    session!
      .actions()
      .filter((action) => action.pressed === true)
      .map((action) => action.id);
  expect(session!.actions().map((action) => action.id)).toEqual([
    'mode-move',
    'mode-h',
    'mode-v',
  ]);
  expect(pressed()).toEqual(['mode-move']);
  expect(view.queryByTestId('tools-action-a1v')).toBeNull();
  run(session!, 'mode-v');
  expect(pressed()).toEqual(['mode-v']);
  expect(view.getByTestId('tools-action-a1v')).toBeDefined();
  expect(view.container.textContent).not.toContain('walls');
  view.unmount();
});
