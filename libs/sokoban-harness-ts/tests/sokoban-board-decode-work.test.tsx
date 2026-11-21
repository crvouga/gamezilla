import { expect, spyOn, test } from 'bun:test';
import { SokobanPlayerView } from '@libs/sokoban-client-ts/sokoban-player';
import { MAXIMUM_BOARD } from '@libs/sokoban-client-ts/sokoban-player.example';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSignal } from 'solid-js';

// regression: sokoban-move-reparses-unchanged-board
test('the first left move on the solved maximum board does not parse its terrain again', () => {
  const rules = sokobanPuzzleContent.rules;
  const initial = rules.initial(MAXIMUM_BOARD);
  if (!initial.accepted) throw new Error('Invalid maximum board');
  let value = initial.state;
  const states = ['r', 'r', 'l'].map((action) => {
    const next = rules.apply(MAXIMUM_BOARD, value, action);
    if (!next.accepted) throw new Error('Invalid regression move');
    value = next.state;
    return value;
  });
  const [definition, setDefinition] = createSignal(MAXIMUM_BOARD);
  const [state, setState] = createSignal(states[1]!);
  const time = createHarnessClock();
  const parse = JSON.parse;
  let boardReads = 0;
  const observed = spyOn(JSON, 'parse').mockImplementation((text, reviver) => {
    if (text === MAXIMUM_BOARD) boardReads += 1;
    return parse(text, reviver);
  });
  try {
    const view = renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider
          colorScheme="dark"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <SokobanPlayerView
            definition={definition()}
            state={state()}
            disabled={false}
            onAction={() => undefined}
            onReturnToLibrary={() => undefined}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    expect(boardReads).toBe(1);
    boardReads = 0;
    setState(states[2]!);
    expect(view.getByTestId('sokoban-counts').getAttribute('data-moves')).toBe(
      '3'
    );
    expect(boardReads).toBe(0);
    setDefinition('{}');
    expect(view.queryByTestId('sokoban-unreadable')).not.toBeNull();
    setDefinition(MAXIMUM_BOARD);
    expect(view.queryByTestId('sokoban-unreadable')).toBeNull();
    expect(boardReads).toBe(1);
  } finally {
    observed.mockRestore();
  }
});
