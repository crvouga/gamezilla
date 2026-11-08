import {
  decodeConnectFour,
  dropDisc,
  encodeConnectFour,
  replayConnectFour,
} from '@libs/connect-four-shared-ts/connect-four';
import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import { TWO_PLAYER_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { createSignal, mergeProps } from 'solid-js';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  ConnectFourGameBoard,
  connectFourPresentation,
} from './connect-four-presentation';

/** The position after `columns` dropped in turn, Red first (0 is column 1). */
function after(columns: string): string {
  return encodeConnectFour(replayConnectFour(columns.split('').map(Number)));
}

/** Connect Four writes a move as its column, counted from 1. */
function columnsPlayed(columns: string): readonly string[] {
  return columns.split('').map((column) => String(Number(column) + 1));
}

/** Eight discs in: Red to move. */
const MID_GAME = '33244521';
/** Ten discs in, five each: Red to move, as a real game's middle reads. */
const MID_GAME_LONGER = `${MID_GAME}63`;
/** Yellow's reply to it waits. */
const MID_GAME_REPLY = `${MID_GAME}6`;

const meta = {
  id: 'screens-games-connect-four-board',
  title: 'Screens/Games/Connect Four/Board',
  component: ConnectFourGameBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(connectFourPresentation, TWO_PLAYER_SIDES, args, context),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(after(''), { interactive: true }),
} satisfies Meta<typeof ConnectFourGameBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new game: Red moves first, so the person playing Red can drop anywhere. */
export const Opening: Story = {
  play: async ({ canvasElement }) => {
    const column = within(canvasElement).getByTestId(
      'custom-game-board-column-1'
    );
    await expect(column).toHaveAccessibleDescription(
      /Arrow keys choose a column/
    );
    await expect(column).toHaveAccessibleDescription(/Enter or Space drops/);
  },
};

/**
 * Mid-game on the person's turn, ten discs in: every open column offers a
 * drop. The one pointed at (column 6) takes a tint and a red ring round its
 * number, a dashed red outline marks where the disc would land, and the
 * line under the board says `Drop in column 6`.
 */
export const YourTurn: Story = {
  args: { position: after(MID_GAME_LONGER) },
  parameters: {
    table: { turn: 'white', moves: columnsPlayed(MID_GAME_LONGER) },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const column = await canvas.findByTestId('custom-game-board-column-6');
    await userEvent.hover(column);
    await expect(column).toHaveAttribute('data-previewed', 'true');
    await expect(
      await canvas.findByTestId('custom-game-board-prompt')
    ).toHaveTextContent('Drop in column 6');
  },
};

/** Mid-game while Yellow decides: the board is shown but takes no drops. */
export const WaitingForOpponent: Story = {
  args: { position: after(MID_GAME_REPLY), interactive: false },
  parameters: {
    table: {
      turn: 'black',
      moves: columnsPlayed(MID_GAME_REPLY),
    } satisfies GameTableStory,
  },
};

/** Someone watching: both seats are the others', and nothing can be dropped. */
export const Watching: Story = {
  args: { position: after(MID_GAME), interactive: false },
  parameters: {
    table: { viewer: null, turn: 'white', moves: columnsPlayed(MID_GAME) },
  },
};

/** Finished positions remain readable through every ancestor, including full columns. */
async function assertReadableFinish(canvasElement: HTMLElement): Promise<void> {
  const canvas = within(canvasElement);
  const board = canvas.getByTestId('custom-game-board');
  for (const disc of board.querySelectorAll(
    '[data-cell]:not([data-disc="0"]) > span'
  )) {
    let element: Element | null = disc;
    while (element && element !== board.parentElement) {
      await expect(Number(getComputedStyle(element).opacity)).toBe(1);
      element = element.parentElement;
    }
  }
  for (const column of board.querySelectorAll('button')) {
    await expect(column).toHaveAttribute('aria-disabled', 'true');
  }
  const before = board.getAttribute('data-cells');
  await userEvent.click(canvas.getByTestId('custom-game-board-column-1'));
  await expect(board).toHaveAttribute('data-cells', before);
}

/** Red's fourth disc in a column wins: the four are marked, and Red is told they won. */
export const Won: Story = {
  // regression: connect-four-final-position-dimmed
  play: async ({ canvasElement }) => {
    await assertReadableFinish(canvasElement);
    const canvas = within(canvasElement);
    for (const cell of [0, 7, 14, 21]) {
      const disc = canvas.getByTestId(`custom-game-board-cell-${cell}`);
      await expect(disc).toHaveAttribute('data-winning', 'true');
      await expect(getComputedStyle(disc).outlineStyle).toBe('solid');
      await expect(
        parseFloat(getComputedStyle(disc).outlineWidth)
      ).toBeGreaterThan(0);
    }
  },
  args: { position: after('0101010'), interactive: false },
  parameters: {
    table: {
      moves: columnsPlayed('0101010'),
      ending: { winner: 'white', reason: 'four in a row' },
    } satisfies GameTableStory,
  },
};

/** Yellow connects four across the bottom: Red sees who won and how. */
export const Lost: Story = {
  args: { position: after('60615253'), interactive: false },
  parameters: {
    table: {
      moves: columnsPlayed('60615253'),
      ending: { winner: 'black', reason: 'four in a row' },
    } satisfies GameTableStory,
  },
};

/** Forty-two discs and no four: the full board is a draw for both. */
export const FullBoardDraw: Story = {
  // regression: connect-four-final-position-dimmed
  play: async ({ canvasElement }) => {
    await assertReadableFinish(canvasElement);
    await expect(
      canvasElement.querySelectorAll('[data-cell]:not([data-disc="0"])')
    ).toHaveLength(42);
  },
  args: {
    position: after('000000111111222222433333344444555555666666'),
    interactive: false,
  },
  parameters: {
    table: {
      moves: columnsPlayed('000000111111222222433333344444555555666666'),
      ending: { winner: 'draw', reason: 'full board' },
    } satisfies GameTableStory,
  },
};

/** Real rule transitions keep the board, seats and move record in sync. */
const interactiveRender: NonNullable<typeof meta.render> = (args, context) => {
  const [game, setGame] = createSignal(decodeConnectFour(args.position));
  const board = mergeProps(args, {
    get position() {
      return encodeConnectFour(game());
    },
    get interactive() {
      return game().result === 0;
    },
    onAction: (action: string) => {
      const next = dropDisc(game(), Number(action));
      if (next) setGame(next);
    },
  });
  const table = {
    get turn() {
      return game().turn === 1 ? 'white' : 'black';
    },
    get viewer() {
      return game().turn === 1 ? 'white' : 'black';
    },
    get moves() {
      return game().moves.map((column) => String(column + 1));
    },
    get ending(): GameTableStory['ending'] {
      const result = game().result;
      return result === 0
        ? undefined
        : {
            winner: result === 3 ? 'draw' : result === 1 ? 'white' : 'black',
            reason: result === 3 ? 'full board' : 'four in a row',
          };
    },
  };
  return renderGameTable(connectFourPresentation, TWO_PLAYER_SIDES, board, {
    parameters: { ...context.parameters, table },
  });
};

/** Drop two discs into one column and observe gravity and alternating sides. */
export const DropADisc: Story = {
  render: interactiveRender,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const column = await canvas.findByTestId('custom-game-board-column-4');
    await userEvent.click(column);
    await expect(
      canvas.getByTestId('custom-game-board-cell-3')
    ).toHaveAttribute('data-disc', '1');
    await userEvent.hover(column);
    await expect(
      canvas.getByTestId('custom-game-board-cell-10')
    ).toHaveAttribute('data-preview-disc', '2');
    await userEvent.click(column);
    await expect(
      canvas.getByTestId('custom-game-board-cell-10')
    ).toHaveAttribute('data-disc', '2');
    await expect(column).toHaveAccessibleName(
      'Drop in column 4, 2 of 6 occupied'
    );
  },
};

/** A full column preserves the position; keyboard navigation finds another. */
export const FullColumn: Story = {
  args: { position: after('000000') },
  render: interactiveRender,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const column = canvas.getByTestId('custom-game-board-column-1');
    await expect(column).toHaveAttribute('aria-disabled', 'true');
    const before = canvas
      .getByTestId('custom-game-board')
      .getAttribute('data-cells');
    await userEvent.click(column);
    await expect(
      canvas.getByTestId('custom-game-board-prompt')
    ).toHaveTextContent('Column 1 is full. Choose another column.');
    await expect(canvas.getByTestId('custom-game-board')).toHaveAttribute(
      'data-cells',
      before
    );
    await expect(column).toHaveAccessibleName('Column 1, full');
    for (let number = 2; number <= 7; number++) {
      await userEvent.keyboard('{ArrowRight}');
      await expect(
        canvas.getByTestId(`custom-game-board-column-${number}`)
      ).toHaveFocus();
    }
    await userEvent.keyboard('{Home}{ArrowRight}');
    await expect(
      canvas.getByTestId('custom-game-board-column-2')
    ).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(
      canvas.getByTestId('custom-game-board-cell-1')
    ).toHaveAttribute('data-disc', '1');
  },
};

/** The final legal drop connects four, marks the line and locks further drops. */
export const ConnectFourToWin: Story = {
  args: { position: after('010101') },
  render: interactiveRender,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-column-1'));
    for (const cell of [0, 7, 14, 21]) {
      await expect(
        canvas.getByTestId(`custom-game-board-cell-${cell}`)
      ).toHaveAttribute('data-winning', 'true');
    }
    await expect(
      canvas.getByTestId('custom-game-board-column-2')
    ).toHaveAttribute('aria-disabled', 'true');
  },
};
