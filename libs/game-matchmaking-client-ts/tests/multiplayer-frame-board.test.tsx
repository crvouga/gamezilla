import { expect, test } from 'bun:test';
import { MultiplayerFrameBoard } from '@libs/game-matchmaking-client-ts/multiplayer-frame-board';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GamePresentation } from '@pkgs/turn-game-shared-ts/game-presentation';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

test('matched Quoridor keeps its board and wall tools in the same live session', () => {
  // regression: matched-game-board-session-actions
  let mounts = 0;
  const [position, setPosition] = createSignal('initial');
  const [interactive, setInteractive] = createSignal(true);
  const actions: string[] = [];
  const presentation = {
    Board: () => null,
    frame: {
      createBoard: (board: GameFrameBoardProps) => {
        mounts += 1;
        const [tool, setTool] = createSignal('move');
        return {
          Board: () => (
            <Button
              title={`${board.position}: ${tool()}`}
              onClick={() => board.onAction(tool())}
            />
          ),
          actions: () => [
            {
              id: 'mode-h',
              label: 'Horizontal wall',
              enabled: board.interactive,
              pressed: tool() === 'h',
              run: () => setTool('h'),
            },
          ],
          controls: () => <Button title="Board options" />,
        };
      },
    },
  } as unknown as GamePresentation<JSX.Element>;
  const board = {
    get position() {
      return position();
    },
    get interactive() {
      return interactive();
    },
    testId: 'multiplayer-board',
    onAction: (action: string) => actions.push(action),
    orientation: 'white',
    sound: false,
    viewer: 'white',
    seats: [],
    syncKey: 0,
    setup: null,
    hand: null,
    committed: [],
    commitment: null,
  } satisfies GameFrameBoardProps;
  const view = renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <MultiplayerFrameBoard presentation={presentation} board={board} />
    </ThemeProvider>
  ));
  const wall = view.getByTestId('multiplayer-board-mode-h');
  fireEvent.click(wall);
  expect(view.getByTestId('multiplayer-board-mode-h')).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  fireEvent.click(view.getByText('initial: h'));
  expect(actions).toEqual(['h']);
  setPosition('after move');
  expect(view.getByText('after move: h')).toBeInTheDocument();
  setInteractive(false);
  expect(view.getByTestId('multiplayer-board-mode-h')).toBeDisabled();
  expect(view.getByText('Board options')).toBeInTheDocument();
  expect(mounts).toBe(1);
});
