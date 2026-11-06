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
import { wordTilesFrame } from './word-tiles-frame';
import { wordTilesGameClient } from './word-tiles-game-client';

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
  return renderGameTable(presentation, seatSides(seats), args, context);
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

/** Three seats: the third player's turn with all scores and rack counts visible. */
export const ThreePlayers: Story = {
  args: {
    position: encodePosition({
      ...newPosition(3, STORY_LEXICON_KEY),
      board: CAT_AND_TOE,
      scores: [10, 3, 0],
      bag: 74,
      turn: 2,
    }),
    hand: null,
    interactive: false,
  },
  parameters: { table: { viewer: null, turn: 'red' } },
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
