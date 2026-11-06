import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  decodePosition,
  encodePosition,
  newPosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import { seatSides } from '@libs/word-tiles-shared-ts/word-tiles-ruleset';
import type { GameFrameBoardProps } from '@pkgs/turn-game-shared-ts/game-frame';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  createWordTilesSession,
  WordTilesBoardView,
  type WordTilesBoardViewProps,
} from './word-tiles-board-view';
import {
  CAT_AND_TOE,
  STORY_LEXICON,
  STORY_LEXICON_KEY,
} from './word-tiles-board-view.example';
import { checkEnlargedCoordinates } from './word-tiles-coordinate.checks';
import { wordTilesFrame } from './word-tiles-frame';
import { wordTilesGameClient } from './word-tiles-game-client';
import { matchJourney } from './word-tiles-match-journey.example';

/** A position from a new two-seat game, with `changes`. */
function table(changes: Partial<WordTilesPosition> = {}): string {
  return encodePosition({ ...newPosition(2, STORY_LEXICON_KEY), ...changes });
}

/** C, A, T, a blank, E, S and Q: the tile ids of the person's rack. */
const RACK = '11,0,82,98,25,77,69';
/** O, E, R, T, I, N and a blank. */
const LATER_RACK = '59,17,70,80,36,53,99';
const MID_GAME = table({
  board: CAT_AND_TOE,
  scores: [10, 3],
  bag: 81,
});

/**
 * The frame around the board, its session made with the story's word list
 * and shuffle as the real board's are made with the loaded list and the
 * app's random.
 */
function renderTable(
  args: WordTilesBoardViewProps,
  context: { readonly parameters: Readonly<Record<string, unknown>> }
) {
  const seats = decodePosition(args.position)?.seats ?? 2;
  const presentation = {
    ...wordTilesGameClient.presentation,
    frame: {
      ...wordTilesFrame(seats),
      createBoard: (board: GameFrameBoardProps) =>
        createWordTilesSession(board, {
          lexicon: {
            state: () => args.lexicon,
            retry: () => args.onRetryLexicon(),
          },
          random: () => args.random(),
        }),
    },
  };
  return renderGameTable(presentation, seatSides(seats), args, {
    parameters: {
      ...context.parameters,
      table: {
        ...(context.parameters['table'] as GameTableStory),
        get turn() {
          return seatSides(seats)[decodePosition(args.position)?.turn ?? 0];
        },
      },
    },
  });
}

const meta = {
  id: 'screens-games-word-tiles-board',
  title: 'Screens/Games/Word Tiles/Board',
  component: WordTilesBoardView,
  tags: ['autodocs'],
  render: (args, context) => renderTable(args, context),
  parameters: {
    appRouter: true,
    controls: {
      exclude: [...BOARD_CONTROLS_EXCLUDE, 'lexicon', 'random'],
    },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: {
    ...boardArgs(table(), { interactive: true, hand: RACK }),
    lexicon: STORY_LEXICON,
    onRetryLexicon: fn(),
    random: () => 0.5,
  },
} satisfies Meta<typeof WordTilesBoardView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new game: the first word must cover the centre star. */
export const Opening: Story = {};

/** Mid-game on the person's turn: words on the board, a fresh rack. */
export const YourTurn: Story = {
  args: { position: MID_GAME, hand: LATER_RACK },
};

/** Teal is playing: the rack shows, but nothing can be sent. */
export const WaitingForOpponent: Story = {
  args: {
    position: table({ board: CAT_AND_TOE, scores: [10, 3], turn: 1 }),
    hand: LATER_RACK,
    interactive: false,
  },
  parameters: { table: { turn: 'black' } satisfies GameTableStory },
};

/** A watcher sees the board and is told racks stay private. */
export const Watching: Story = {
  args: { position: MID_GAME, hand: null, interactive: false },
  parameters: { table: { viewer: null, turn: 'white' } },
};

/** The word list would not load here: the board offers loading it again. */
export const WordListUnavailable: Story = {
  args: {
    lexicon: {
      status: 'unavailable',
      reason: 'Word list enable1.90ef7a729517 is unavailable',
    },
  },
};

/** Four seats: every rack's count beside its seat, one board between them. */
export const FourPlayers: Story = {
  args: {
    position: encodePosition({
      ...newPosition(4, STORY_LEXICON_KEY),
      board: CAT_AND_TOE,
      scores: [10, 3, 0, 0],
      bag: 67,
      turn: 2,
    }),
    hand: null,
    interactive: false,
  },
  parameters: { table: { viewer: null, turn: 'red' } },
};

/** Amber used the last tile with the bag empty: the game is over. */
export const GameOver: Story = {
  args: {
    position: table({
      board: CAT_AND_TOE,
      scores: [187, 154],
      racks: [0, 2],
      bag: 0,
      turn: 1,
      ended: 'out',
    }),
    hand: '',
    interactive: false,
  },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'rack emptied' },
    } satisfies GameTableStory,
  },
};

/** A position this app cannot read says so. */
export const Unreadable: Story = {
  args: { position: 'wt2|not-a-position', hand: null },
};

/** C, A and T placed across the star: the preview scores the word it checked. */
export const PlaceAWord: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [tile, cell] of [
      ['11', 'g8'],
      ['0', 'h8'],
      ['82', 'i8'],
    ] as const) {
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-rack-${tile}`)
      );
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-cell-${cell}`)
      );
    }
    await expect(
      await canvas.findByTestId('custom-game-board-status')
    ).toHaveTextContent(/^Scores .*points\.$/);
  },
};

/** While the word list loads, a placed word is scored but not yet checked. */
export const CheckingWords: Story = {
  args: { lexicon: { status: 'loading' } },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const [tile, cell] of [
      ['11', 'g8'],
      ['0', 'h8'],
      ['82', 'i8'],
    ] as const) {
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-rack-${tile}`)
      );
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-cell-${cell}`)
      );
    }
    await expect(
      await canvas.findByTestId('custom-game-board-status')
    ).toHaveTextContent('Checking the words');
  },
};

/** Three seats keep all scores visible without exposing another rack. */
export const ThreePlayers: Story = {
  args: {
    position: encodePosition({
      ...newPosition(3, STORY_LEXICON_KEY),
      board: CAT_AND_TOE,
      scores: [10, 3, 0],
      bag: 74,
    }),
    hand: LATER_RACK,
  },
};

/** Draft recovery asserts real tile movement, not an action callback. */
export const RecallAndRestore: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const cell = await canvas.findByTestId('custom-game-board-cell-h8');
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-rack-11')
    );
    await userEvent.click(cell);
    await expect(cell).toHaveAttribute('data-state', 'tentative');
    await expect(cell).toHaveAccessibleName('C 3, h8, your tentative tile');
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-recall')
    );
    await expect(cell).toHaveAttribute('data-state', 'empty');
    await userEvent.click(await canvas.findByTestId('custom-game-board-undo'));
    await expect(cell).toHaveAttribute('data-state', 'tentative');
    await userEvent.click(await canvas.findByTestId('custom-game-board-redo'));
    await expect(cell).toHaveAttribute('data-state', 'empty');
  },
};

/** Assigning a blank changes the tile on the board while retaining zero points. */
export const AssignABlank: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-rack-98')
    );
    const cell = await canvas.findByTestId('custom-game-board-cell-h8');
    await userEvent.click(cell);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-blank-E')
    );
    await expect(cell).toHaveAccessibleName(
      'E 0, h8, your tentative blank as E'
    );
    await expect(cell).toHaveAttribute('data-state', 'tentative');
  },
};

/** Real authority accepts the retained CAT draft after the word list recovers. */
export const RecoverAndSubmit: Story = {
  args: { lexicon: { status: 'unavailable', reason: 'offline' } },
  render: (args, context) => renderTable(matchJourney(args), context),
  play: async ({ canvasElement }) => {
    // regression: word-tiles-retry-retained-accepted-draft
    const canvas = within(canvasElement);
    await expect(
      canvas.getByTestId('custom-game-board-lexicon-retry')
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Enlarge board' })
    );
    for (const [tile, cell] of [
      ['11', 'g8'],
      ['0', 'h8'],
      ['82', 'i8'],
    ]) {
      await userEvent.click(
        canvas.getByTestId(`custom-game-board-rack-${tile}`)
      );
      await userEvent.click(
        canvas.getByTestId(`custom-game-board-cell-${cell}`)
      );
    }
    await expect(
      canvas.getByText(
        /Reload it to preview words, or play for the game to check them/
      )
    ).toBeVisible();
    // The local list is optional: the game authority still checks submitted words.
    await expect(canvas.getByTestId('custom-game-board-submit')).toBeEnabled();
    await expect(
      canvas.getByText(/the game checks the words when you play/)
    ).toBeVisible();
    await userEvent.click(
      canvas.getByTestId('custom-game-board-lexicon-retry')
    );
    await expect(
      canvas.getByTestId('custom-game-board-cell-h8')
    ).toHaveAttribute('data-state', 'tentative');
    await userEvent.click(canvas.getByTestId('custom-game-board-submit'));
    await expect(
      canvas.getByTestId('custom-game-board-cell-h8')
    ).toHaveAttribute('data-state', 'committed');
    await expect(
      canvas.queryByTestId('custom-game-board-rack-11')
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId('custom-game-board-submit')).toBeDisabled();
    await expect(
      within(canvas.getByTestId('custom-game-white')).getByText('10', {
        exact: true,
      })
    ).toBeVisible();
    await expect(canvas.getByTestId('custom-game-status')).toHaveTextContent(
      'Teal — to play'
    );
    await expect(
      within(canvas.getByTestId('custom-game-black')).getByText('To move', {
        exact: true,
      })
    ).toBeVisible();
    await expect(
      canvas.getByText(/You can plan a word while you wait/)
    ).toBeVisible();
  },
};

export const AcceptedPass: Story = {
  render: (args, context) => renderTable(matchJourney(args), context),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-pass'));
    await expect(canvas.getByTestId('custom-game-board-pass')).toBeDisabled();
    await expect(
      canvas.getByTestId('custom-game-board-cell-h8')
    ).toHaveAttribute('data-state', 'empty');
    await expect(
      canvas.getByTestId('custom-game-board-rack-11')
    ).toBeInTheDocument();
  },
};

export const AcceptedExchange: Story = {
  render: (args, context) => renderTable(matchJourney(args), context),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-exchange'));
    await userEvent.click(canvas.getByTestId('custom-game-board-rack-11'));
    await expect(
      canvas.queryByTestId('custom-game-board-submit')
    ).not.toBeInTheDocument();
    await userEvent.click(
      canvas.getByTestId('custom-game-board-exchange-confirm')
    );
    await expect(
      canvas.queryByTestId('custom-game-board-rack-11')
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId('custom-game-board-pass')).toBeDisabled();
    await expect(
      canvas.queryByTestId('custom-game-board-exchange-confirm')
    ).not.toBeInTheDocument();
    await expect(
      canvas.queryByTestId('custom-game-board-exchange-cancel')
    ).not.toBeInTheDocument();
    await expect(canvas.getByTestId('custom-game-board-submit')).toBeDisabled();
  },
};

/** Sticky coordinates and the focused target remain clear at centre and all edges. */
export const EnlargedCoordinates: Story = {
  play: async ({ canvasElement }) => checkEnlargedCoordinates(canvasElement),
};
