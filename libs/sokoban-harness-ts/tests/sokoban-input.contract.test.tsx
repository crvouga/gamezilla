import { expect, test } from 'bun:test';
import { SokobanEditor } from '@libs/sokoban-client-ts/sokoban-editor';
import { SokobanPlayerView as SokobanPlayer } from '@libs/sokoban-client-ts/sokoban-player';
import {
  DENSE_MAXIMUM_BOARD,
  MAXIMUM_BOARD,
  TWO_CRATES,
} from '@libs/sokoban-client-ts/sokoban-player.example';
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

function render(ui: () => JSX.Element, width = 390) {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 844 }}>
        {ui()}
      </ThemeProvider>
    </ClockProvider>
  ));
}

function player(width = 390, definition = CORRIDOR) {
  const rules = sokobanPuzzleContent.rules;
  const start = rules.initial(definition);
  if (!start.accepted) throw new Error('corridor refused');
  const [state, setState] = createSignal(start.state);
  const [disabled, setDisabled] = createSignal(false);
  const actions: string[] = [];
  const view = render(
    () => (
      <SokobanPlayer
        onReturnToLibrary={() => {
          throw new Error('Unexpected navigation');
        }}
        definition={definition}
        state={state()}
        disabled={disabled()}
        onAction={(action) => {
          const change = rules.apply(definition, state(), action);
          if (!change.accepted)
            throw new Error('the player sent a refused move');
          actions.push(action);
          setState(change.state);
        }}
      />
    ),
    width
  );
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

// regression: sokoban-wide-touch-screen-hides-steering
test('a wide touch screen retains the named movement pad', () => {
  const { view, actions } = player(1440);
  fireEvent.click(view.getByRole('button', { name: 'Move right' }));
  expect(actions).toEqual(['r']);
  expect(view.getByTestId('sokoban-move').getAttribute('data-layout')).toBe(
    'arrows'
  );
});

// regression: sokoban-save-queue-silently-drops-fifth-direction
test('the fifth queued direction reports the limit without promising it was saved', () => {
  const { view, board, setDisabled } = player();
  setDisabled(true);
  for (const key of [
    'ArrowRight',
    'ArrowRight',
    'ArrowLeft',
    'ArrowLeft',
    'ArrowRight',
  ])
    fireEvent.keyDown(board, { key });
  expect(view.getByTestId('sokoban-saving').textContent).toContain(
    'Not added: four moves waiting.'
  );
  setDisabled(false);
  expect(view.queryByTestId('sokoban-saving')).toBeNull();
  expect(view.getByTestId('sokoban-counts').getAttribute('data-moves')).toBe(
    '4'
  );
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
  // On a phone the size is one closed row until it is opened.
  expect(view.queryByLabelText('Columns')).toBeNull();
  fireEvent.click(view.getByTestId('sokoban-size-toggle'));
  fireEvent.input(view.getByLabelText('Columns'), { target: { value: '3' } });
  fireEvent.click(view.getByTestId('sokoban-resize'));
  expect(view.getByTestId('sokoban-removed').getAttribute('data-removed')).toBe(
    'goal E1'
  );
});

// regression: sokoban-editor-tools-as-buttons — the eight tools were eight
// separate pill buttons, the chosen one filled like a command. They are now
// one named group of chips with the chosen tool marked.
test('the editor offers its tools as one group, with the chosen tool marked', () => {
  const view = render(() => (
    <SokobanEditor
      definition={CORRIDOR}
      disabled={false}
      onChange={() => undefined}
    />
  ));
  const group = view.getByRole('radiogroup', { name: 'Tool' });
  const chips = group.querySelectorAll('[role="radio"]');
  expect(chips).toHaveLength(8);
  // regression: sokoban-editor-tools-text-only — the tools were text-only
  // pills. Each is now a tile with a swatch of the square it lays down,
  // drawn as the board draws it, over its name.
  const swatch = (tool: string): Element | null =>
    view
      .getByTestId(`sokoban-tool-${tool}`)
      .querySelector('[data-board-theme="sokoban"] [data-tone]');
  expect(
    ['wall', 'floor', 'goal', 'outside', 'worker', 'crate'].map((tool) => [
      swatch(tool)?.getAttribute('data-tone'),
      swatch(tool)?.getAttribute('data-identity') ?? null,
    ])
  ).toEqual([
    ['occupied', null],
    ['open', null],
    ['open', 'four'],
    ['quiet', null],
    ['open', 'three'],
    ['open', 'one'],
  ]);
  expect(view.getByTestId('sokoban-tool-crate').textContent).toContain('Crate');
  const wall = view.getByTestId('sokoban-tool-wall');
  const crate = view.getByTestId('sokoban-tool-crate');
  expect(group.contains(crate)).toBe(true);
  fireEvent.click(crate);
  expect(crate.getAttribute('aria-checked')).toBe('true');
  expect(wall.getAttribute('aria-checked')).toBe('false');
});

function precedes(a: Element, b: Element): boolean {
  return (
    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

// regression: sokoban-editor-size-below-fold — the board's size inputs came
// after the board, its caption and its corrections, below a desktop's
// 900px fold, and the builder's pieces were drawn as bare glyphs. The tools
// now head the board; the size heads the notes, which sit beside the board
// under the tools where there is room, never after the caption and the
// corrections; and each piece is drawn as a token (crate, crate on goal,
// worker, goal) as the player draws it.
test('the editor puts the tools above the board, the size beside it, pieces as tokens', () => {
  const view = render(() => (
    <SokobanEditor
      definition={JSON.stringify({ format: 1, rows: ['#@$.*'] })}
      disabled={false}
      onChange={() => undefined}
    />
  ));
  const size = view.getByTestId('sokoban-size');
  const tools = view.getByTestId('sokoban-tools');
  const board = view.getByTestId('sokoban-editor-board');
  expect(precedes(tools, board)).toBe(true);
  const said =
    view.queryByTestId('sokoban-ready') ??
    view.getByTestId('sokoban-corrections');
  expect(precedes(size, said)).toBe(true);
  // The workbench's notes column, which wide sits beside the board under
  // the tools (above a desktop's fold), and holds the size first.
  const notes = size.closest('[data-component="EditorWorkbench"] > div > div');
  expect(notes?.firstElementChild?.contains(size)).toBe(true);
  expect(notes?.contains(board)).toBe(false);
  expect(notes?.contains(tools)).toBe(false);
  const identity = (square: string): string | null =>
    view.getByTestId(`sokoban-square-${square}`).getAttribute('data-identity');
  expect(
    ['A1', 'B1', 'C1', 'D1', 'E1'].map((square) => identity(square))
  ).toEqual([null, 'three', 'one', 'four', 'two']);
});

// regression: sokoban-editor-board-below-config — on a phone the size
// inputs, the undo row and two rows of tool pills filled the screen and
// the board started below them. The size is now one closed row there,
// the tools one picker, and what to correct follows the board.
// regression: sokoban-editor-phone-size-over-board — once every tool showed
// its name, the closed size row over the board pushed the board's last row
// below a phone's fold. The size is set once, so on a phone it follows the
// board, with the notes, and the board sits right under the tools.
test('on a phone the board follows its tools, then the size a closed row, the notes after it', () => {
  const view = render(() => (
    <SokobanEditor
      definition={CORRIDOR}
      disabled={false}
      onChange={() => undefined}
    />
  ));
  const toggle = view.getByTestId('sokoban-size-toggle');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(toggle.textContent).toBe('Board size · 5 × 1');
  const board = view.getByTestId('sokoban-editor-board');
  expect(precedes(view.getByTestId('sokoban-tools'), board)).toBe(true);
  expect(precedes(board, view.getByTestId('sokoban-size'))).toBe(true);
  const said =
    view.queryByTestId('sokoban-ready') ??
    view.getByTestId('sokoban-corrections');
  expect(precedes(board, said)).toBe(true);
});

// regression: sokoban-direction-text-row — on a phone the movement
// controls were a wrapping row of text buttons ("← Left", "↑ Up"), not
// laid out the way the moves go. They are now a spatial pad of icon
// buttons (up over left and right, down below), named for listeners.
// regression: sokoban-phone-puzzle-too-tall — the pad's 48px buttons, the
// commands and a headed puzzle card made a phone's Sokoban screen taller
// than its viewport. The pad is now the 44px thumb pad (every button still
// a full touch target), and the puzzle card is headed by the pack's place.
test('on a phone the moves are a spatial pad of named icon buttons', () => {
  const { view, actions } = player();
  const pad = view.getByTestId('sokoban-move');
  expect(pad.getAttribute('data-component')).toBe('DirectionPad');
  expect(pad.getAttribute('data-size')).toBe('sm');
  for (const [heading, name] of [
    ['up', 'Move up'],
    ['left', 'Move left'],
    ['right', 'Move right'],
    ['down', 'Move down'],
  ] as const) {
    const button = view.getByTestId(`sokoban-move-${heading}`);
    expect(pad.contains(button)).toBe(true);
    expect(button.getAttribute('aria-label')).toBe(name);
    expect(button.textContent).toBe('');
  }
  fireEvent.click(view.getByTestId('sokoban-move-right'));
  expect(actions).toEqual(['r']);
});

// regression: sokoban-maximum-board-pieces-too-small
test('a maximum board has a close view that follows the worker and maps taps to the full board', () => {
  const { view, board, actions } = player(320, MAXIMUM_BOARD);
  expect(board.querySelectorAll('[role="img"]')).toHaveLength(400);
  fireEvent.click(view.getByRole('button', { name: 'Look closer' }));
  expect(board.querySelectorAll('[role="img"]')).toHaveLength(36);
  for (let move = 0; move < 5; move++)
    fireEvent.keyDown(board, { key: 'ArrowRight' });
  expect(view.getByRole('img', { name: 'G2: floor, worker' })).toBeTruthy();
  board.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 288, height: 288 }) as DOMRect;
  fireEvent.pointerDown(board, { clientX: 216, clientY: 72 });
  fireEvent.pointerUp(board, { clientX: 216, clientY: 72 });
  expect(actions).toEqual(['r', 'r', 'r', 'r', 'r', 'r']);
  expect(view.getByRole('img', { name: 'H2: floor, worker' })).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'Show whole board' }));
  expect(board.querySelectorAll('[role="img"]')).toHaveLength(400);
  expect(view.getByTestId('sokoban-counts').getAttribute('data-moves')).toBe(
    '6'
  );
});

// regression: sokoban-close-view-sticks-on-smaller-board
test('changing from a close maximum board to a small board restores every square', () => {
  const [definition, setDefinition] = createSignal(MAXIMUM_BOARD);
  const state = () => {
    const initial = sokobanPuzzleContent.rules.initial(definition());
    if (!initial.accepted) throw new Error('Fixture board refused');
    return initial.state;
  };
  const view = render(() => (
    <SokobanPlayer
      definition={definition()}
      state={state()}
      disabled={false}
      onAction={() => undefined}
      onReturnToLibrary={() => undefined}
    />
  ));
  fireEvent.click(view.getByRole('button', { name: 'Look closer' }));
  expect(
    view.getByTestId('sokoban-board').querySelectorAll('[role="img"]')
  ).toHaveLength(36);
  setDefinition(TWO_CRATES);
  expect(
    view.getByTestId('sokoban-board').querySelectorAll('[role="img"]')
  ).toHaveLength(42);
  expect(view.getByTestId('sokoban-board').getAttribute('aria-label')).toBe(
    'Sokoban board'
  );
  expect(view.queryByRole('button', { name: 'Show whole board' })).toBeNull();
});

// regression: sokoban-counts-split-on-narrow-phone
test('on a narrow phone each count keeps its label beside its number', () => {
  const { view } = player();
  const counts = view.getByTestId('sokoban-counts');
  // A phone keeps the counts on two lines, so a longer number never re-wraps.
  expect(counts.textContent).toBe('Moves 0Pushes 0');
  expect(counts.querySelectorAll('.block')).toHaveLength(2);
  const unbroken = [
    ...counts.querySelectorAll('.whitespace-nowrap, .block'),
  ].map((part) => part.textContent);
  expect(unbroken).toEqual(['Moves 0', 'Pushes 0']);
});

// regression: sokoban-feedback-moves-controls
test('blocked and solved feedback appear beside the pad or over the board, never above the controls', () => {
  const { view, board } = player();
  const row = view.getByTestId('sokoban-move').parentElement;
  fireEvent.keyDown(board, { key: 'ArrowLeft' });
  const refusal = view.getByTestId('sokoban-refusal');
  expect(row?.contains(refusal)).toBe(true);
  expect(refusal.textContent).toBe("The worker's way is blocked.");
});

// regression: sokoban-close-view-hides-crates-silently
test('the close view says how many crates and open goals are out of view', () => {
  const start = sokobanPuzzleContent.rules.initial(DENSE_MAXIMUM_BOARD);
  if (!start.accepted) throw new Error('Fixture board refused');
  const view = render(() => (
    <SokobanPlayer
      definition={DENSE_MAXIMUM_BOARD}
      state={start.state}
      disabled={false}
      onAction={() => undefined}
      onReturnToLibrary={() => undefined}
    />
  ));
  fireEvent.click(view.getByRole('button', { name: 'Look closer' }));
  const outside = view.getByTestId('sokoban-outside-view');
  expect(outside.getAttribute('data-crates')).toBe('34');
  expect(outside.getAttribute('data-goals')).toBe('34');
  expect(outside.textContent).toBe(
    'Close view follows the worker. Out of view: 34 crates and 34 open goals.'
  );
});

// regression: sokoban-solved-card-hides-board
test('solving leaves the board uncovered and offers the way on once, beside the pad', () => {
  const { view, board } = player();
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  const solved = view.getByTestId('sokoban-solved');
  const row = view.getByTestId('sokoban-move').parentElement;
  expect(row?.contains(solved)).toBe(true);
  expect(board.parentElement?.contains(solved)).toBe(false);
  expect(view.getAllByRole('button', { name: 'More puzzles' })).toHaveLength(1);
  expect(view.queryByText('Keep playing or choose another puzzle.')).toBeNull();
});

// regression: sokoban-solved-name-hides-label
test('the solved action is named by the words it shows', () => {
  const { view, board } = player();
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  const action = view.getByRole('button', { name: 'More puzzles' });
  expect(action.getAttribute('aria-label')).toBeNull();
  expect(action.textContent).toContain('More puzzles');
});

// regression: sokoban-solved-repeats-shell-way-on
test('when the screen offers a way on, solving says so once and adds none of its own', () => {
  const start = sokobanPuzzleContent.rules.initial(CORRIDOR);
  if (!start.accepted) throw new Error('corridor refused');
  const [state, setState] = createSignal(start.state);
  const view = render(() => (
    <SokobanPlayer
      definition={CORRIDOR}
      state={state()}
      disabled={false}
      context={{ kind: 'pack', shellOffersWayOn: true }}
      onAction={(action) => {
        const change = sokobanPuzzleContent.rules.apply(
          CORRIDOR,
          state(),
          action
        );
        if (change.accepted) setState(change.state);
      }}
      onReturnToLibrary={() => {
        throw new Error('The screen offers the way on');
      }}
    />
  ));
  const board = view.getByTestId('sokoban-board');
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  fireEvent.keyDown(board, { key: 'ArrowRight' });
  expect(view.getByTestId('sokoban-solved').textContent).toContain('Solved.');
  expect(view.queryByRole('button', { name: 'More puzzles' })).toBeNull();
});
