import { expect, test } from 'bun:test';
import { createQuoridorBoard } from '@libs/quoridor-client-ts/quoridor-board';
import { quoridorBoardCells } from '@libs/quoridor-client-ts/quoridor-board-cells';
import { quoridorTargetOptions } from '@libs/quoridor-client-ts/quoridor-board-tools';
import {
  encodeQuoridor,
  newQuoridor,
  playQuoridor,
  type Quoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

const SOUTH_WINS = 'e2 d9 e3 c9 e4 b9 e5 a9 e6 a8 e7 a7 e8 a6 e9'.split(' ');
/** Classic South spends all ten walls while North shuffles. */
const SOUTH_OUT_OF_WALLS =
  'a1h e8 c1h e9 e1h e8 g1h e9 a3h e8 c3h e9 e3h e8 g3h e9 a5h e8 c5h e9'.split(
    ' '
  );

function mount(start: Quoridor, interactive: boolean) {
  const { clock, timers } = createHarnessClock();
  const [game, setGame] = createSignal(start);
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {createQuoridorBoard({
          get position() {
            return encodeQuoridor(game());
          },
          syncKey: 0,
          orientation: 'white',
          interactive,
          sound: false,
          setup: null,
          hand: null,
          committed: [],
          commitment: null,
          testId: 'truth',
          onAction: (action) => {
            const next = playQuoridor(game(), action);
            if (next !== null) setGame(next);
          },
        }).Board()}
      </ThemeProvider>
    </ClockProvider>
  ));
  return { view, setGame, game };
}

// regression: quoridor-read-only-board-shows-move-hints
test('watchers and finished games see no legal-move markers in either variant', () => {
  for (const mode of ['classic', 'hill'] as const) {
    const opening = newQuoridor(mode);
    for (const cells of [
      quoridorBoardCells(opening, 'move', false, null),
      quoridorBoardCells(
        replayQuoridor('classic', SOUTH_WINS),
        'move',
        true,
        null
      ),
    ]) {
      expect(cells.filter((cell) => cell.glyph === '○')).toEqual([]);
      expect(cells.filter((cell) => cell.emphasis === 'preview')).toEqual([]);
      expect(cells.some((cell) => /legal move/.test(cell.label))).toBe(false);
    }
    expect(
      quoridorBoardCells(opening, 'move', true, null).some(
        (cell) => cell.glyph === '○'
      )
    ).toBe(true);
  }
  const { view } = mount(newQuoridor('classic'), false);
  expect(view.getByTestId('truth-wall-status').textContent).toBe(
    'Waiting for South red circle to move. This board is read-only.'
  );
  view.unmount();
});

// regression: quoridor-goal-marker-jumps-after-win
test('a finished classic game keeps marking the winner’s goal row', () => {
  const won = replayQuoridor('classic', SOUTH_WINS);
  expect(won.winner).toBe(0);
  const goals = quoridorBoardCells(won, 'move', false, null)
    .filter((cell) => cell.goal)
    .map((cell) => cell.id);
  expect(goals).toEqual(['a9', 'b9', 'c9', 'd9', 'e9', 'f9', 'g9', 'h9', 'i9']);
});

// regression: quoridor-classic-no-walls-mentions-pass
test('classic with no walls left never offers a pass the game does not have', () => {
  const { view } = mount(replayQuoridor('classic', SOUTH_OUT_OF_WALLS), true);
  const status = view.getByTestId('truth-wall-status').textContent;
  expect(status).toBe('You have no walls left. Move your pawn.');
  view.unmount();
});

// regression: quoridor-wall-tool-carries-into-next-turn
test('after a wall is placed the next turn starts with the pawn tool', () => {
  for (const mode of ['classic', 'hill'] as const) {
    const { view } = mount(newQuoridor(mode), true);
    fireEvent.click(view.getByTestId('truth-mode-h'));
    fireEvent.click(view.getByTestId('truth-action-d4h'));
    fireEvent.click(view.getByTestId('truth-wall-commit'));
    expect(
      view.getByTestId('truth-mode-move').getAttribute('aria-pressed')
    ).toBe('true');
    expect(view.getByTestId('truth-mode-h').getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(view.queryByTestId('truth-action-d4h')).toBeNull();
    expect(view.getByTestId('truth-action-d4')).toBeDefined();
    view.unmount();
  }
});

// regression: quoridor-picker-filter-matches-every-wall
test('the wall anchor picker filters by coordinate, not by shared label words', () => {
  const cells = quoridorBoardCells(newQuoridor('classic'), 'h', true, null);
  const options = quoridorTargetOptions('truth', 'h', cells);
  const matching = (query: string) =>
    options.filter((option) => option.searchText.includes(query));
  expect(matching('a').map((option) => option.value)).toEqual([
    'a8',
    'a7',
    'a6',
    'a5',
    'a4',
    'a3',
    'a2',
    'a1',
  ]);
  expect(matching('d4').map((option) => option.value)).toEqual(['d4']);
  expect(options.find((option) => option.value === 'd4')?.label).toBe(
    'Wall starts above d4'
  );
});
