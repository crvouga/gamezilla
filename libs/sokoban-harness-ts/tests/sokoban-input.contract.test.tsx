import { expect, test } from 'bun:test';
import { SokobanEditor } from '@libs/sokoban-client-ts/sokoban-editor';
import { SokobanPlayer } from '@libs/sokoban-client-ts/sokoban-player';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

/** Worker B1, crate C1, goal E1; A1 is a wall. */
const CORRIDOR = JSON.stringify({ format: 1, rows: ['#@$ .'] });

function render(ui: () => JSX.Element) {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        {ui()}
      </ThemeProvider>
    </ClockProvider>
  ));
}

function player() {
  const rules = sokobanPuzzleContent.rules;
  const start = rules.initial(CORRIDOR);
  if (!start.accepted) throw new Error('corridor refused');
  const [state, setState] = createSignal(start.state);
  const [disabled, setDisabled] = createSignal(false);
  const actions: string[] = [];
  const view = render(() => (
    <SokobanPlayer
      definition={CORRIDOR}
      state={state()}
      disabled={disabled()}
      onAction={(action) => {
        const change = rules.apply(CORRIDOR, state(), action);
        if (!change.accepted) throw new Error('the player sent a refused move');
        actions.push(action);
        setState(change.state);
      }}
    />
  ));
  return {
    view,
    actions,
    setDisabled,
    board: view.getByTestId('sokoban-board'),
  };
}

test('arrow keys, W A S D and the buttons send only moves the rules accept', () => {
  const { view, actions, board } = player();
  fireEvent.keyDown(board, { key: 'ArrowLeft' });
  expect(actions).toEqual([]);
  expect(view.getByTestId('sokoban-refusal').getAttribute('data-code')).toBe(
    'blocked'
  );
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.keyDown(board, { key: 'd' });
  fireEvent.click(view.getByTestId('sokoban-move-up'));
  expect(actions).toEqual(['r', 'r']);
  expect(view.queryByTestId('sokoban-refusal')).not.toBeNull();
  expect(view.getByTestId('sokoban-counts').getAttribute('data-pushes')).toBe(
    '2'
  );
});

test('moves pressed while one is being kept are sent in order once it lands', () => {
  const { actions, board, setDisabled } = player();
  setDisabled(true);
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  expect(actions).toEqual([]);
  setDisabled(false);
  expect(actions).toEqual(['r', 'r']);
});

test('a tap beside the worker steps toward it and any other tap does nothing', () => {
  const { actions, board } = player();
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 500, height: 100 }) as DOMRect;
  const tap = (x: number) => {
    fireEvent.pointerDown(board, { clientX: x, clientY: 50 });
    fireEvent.pointerUp(board, { clientX: x, clientY: 50 });
  };
  tap(450);
  expect(actions).toEqual([]);
  tap(250);
  expect(actions).toEqual(['r']);
});

test('the editor paints with its tools, refuses misplaced pieces and lists corrections', () => {
  const [definition, setDefinition] = createSignal(CORRIDOR);
  const view = render(() => (
    <SokobanEditor
      definition={definition()}
      disabled={false}
      onChange={setDefinition}
    />
  ));
  fireEvent.click(view.getByTestId('sokoban-tool-worker'));
  fireEvent.click(view.getByTestId('sokoban-square-A1'));
  expect(definition()).toBe(CORRIDOR);
  expect(
    view.getByTestId('sokoban-edit-refusal').getAttribute('data-code')
  ).toBe('not_standable');
  fireEvent.click(view.getByTestId('sokoban-tool-erase'));
  fireEvent.click(view.getByTestId('sokoban-square-B1'));
  const board = decodeSokobanBoard(definition());
  expect(board.valid && board.value.worker).toBeNull();
  expect(view.queryByTestId('sokoban-correction-needs_worker')).not.toBeNull();
  fireEvent.input(view.getByLabelText('Columns'), { target: { value: '3' } });
  fireEvent.click(view.getByTestId('sokoban-resize'));
  expect(view.getByTestId('sokoban-removed').getAttribute('data-removed')).toBe(
    'goal E1'
  );
});
