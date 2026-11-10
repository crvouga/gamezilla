import {
  BOARD_CONTROLS_EXCLUDE,
  boardArgs,
  type GameTableStory,
  renderGameTable,
} from '@libs/game-session-client-ts/game-frame-table.example';
import {
  encodeQuoridor,
  replayQuoridor,
} from '@libs/quoridor-shared-ts/quoridor';
import { TWO_PLAYER_SIDES } from '@pkgs/turn-game-shared-ts/game-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { expectQuoridorActionsFit } from './quoridor-action-bounds.example';
import { QuoridorBoard } from './quoridor-board';
import { quoridorGameClient } from './quoridor-game-client';
import { quoridorJourney } from './quoridor-journey.example';
import { cancelQuoridorWallWithKeyboard } from './quoridor-keyboard.example';
import {
  chooseQuoridorCoordinate,
  expectQuoridorBoardUsesColumn,
  expectQuoridorCellHierarchy,
  expectQuoridorGoalMarker,
  expectQuoridorPawnInk,
  expectQuoridorTargetVisible,
} from './quoridor-precision.example';
import {
  expectQuoridorSpatialArea,
  expectQuoridorWallPreview,
} from './quoridor-wall-preview.example';

/** The classic position after `actions`, South first. */
function classic(actions: string): string {
  return encodeQuoridor(
    replayQuoridor('classic', actions === '' ? [] : actions.split(' '))
  );
}

/** Both pawns advanced and four walls placed; South to move. */
const MID_GAME = 'e2 e8 e3 e7 d4h e6 f6v d7h';
/** South walks up the e file while North steps aside: South reaches row 9. */
const SOUTH_WINS = 'e2 d9 e3 c9 e4 b9 e5 a9 e6 a8 e7 a7 e8 a6 e9';
/** South spends all ten walls while North shuffles. */
const SOUTH_OUT_OF_WALLS =
  'a1h e8 c1h e9 e1h e8 g1h e9 a3h e8 c3h e9 e3h e8 g3h e9 a5h e8 c5h e9';
/** Fixtures show the moves that reached them, as a live table does. */
const moves = (actions: string) => actions.split(' ');

const meta = {
  id: 'screens-games-quoridor-classic',
  title: 'Screens/Games/Quoridor/Classic',
  component: QuoridorBoard,
  // A desktop capture is the 1440x900 desktop window, where the board's
  // spatial checks (a 440px board, 44px squares) hold with every tool in
  // view; a phone-height desktop frame would cut the board to fit.
  tags: ['autodocs', 'viewport-native-height'],
  render: (args, context) =>
    renderGameTable(
      quoridorGameClient.presentation,
      TWO_PLAYER_SIDES,
      args,
      context
    ),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(classic(''), { interactive: true }),
} satisfies Meta<typeof QuoridorBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The start: South moves first, ten walls each, the move tool chosen. */
// regression: quoridor-competing-cell-chrome
// regression: quoridor-spatial-task-too-small
export const Opening: Story = {
  play: async ({ canvasElement }) => {
    await expectQuoridorActionsFit(canvasElement);
    await expectQuoridorCellHierarchy(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await expectQuoridorBoardUsesColumn(canvasElement);
  },
};

/** Mid-game on South's turn: walls on the board, fewer left to place. */
export const YourTurn: Story = {
  args: { position: classic(MID_GAME) },
  parameters: { table: { moves: moves(MID_GAME) } satisfies GameTableStory },
};

/** North is deciding: the board is read-only and the tools are off. */
export const WaitingForOpponent: Story = {
  args: { position: classic(`${MID_GAME} c3v`), interactive: false },
  parameters: {
    table: {
      turn: 'black',
      moves: moves(`${MID_GAME} c3v`),
    } satisfies GameTableStory,
  },
};

/** A watcher follows the game from outside it. */
export const Watching: Story = {
  args: { position: classic(MID_GAME), interactive: false },
  parameters: {
    table: { viewer: null, turn: 'white', moves: moves(MID_GAME) },
  },
};

/** Exhausting walls keeps pawn moves available and explains the disabled tools. */
export const NoWallsLeft: Story = {
  args: {
    position: classic(SOUTH_OUT_OF_WALLS),
  },
  parameters: {
    table: { moves: moves(SOUTH_OUT_OF_WALLS) } satisfies GameTableStory,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByTestId('custom-game-board-mode-h')).toBeDisabled();
    await expect(canvas.getByTestId('custom-game-board-mode-v')).toBeDisabled();
    await expect(
      canvas.getByTestId('custom-game-board-mode-move')
    ).toBeEnabled();
    await expect(
      canvas.getByTestId('custom-game-board-wall-status')
    ).toHaveTextContent('You have no walls left. Move your pawn');
  },
};

/** South reached the opposite home row and won. */
export const Won: Story = {
  args: { position: classic(SOUTH_WINS), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'opposite row reached' },
      moves: moves(SOUTH_WINS),
    } satisfies GameTableStory,
  },
};

/** North's side of the same game: South got there first. */
export const Lost: Story = {
  args: {
    position: classic(SOUTH_WINS),
    interactive: false,
    orientation: 'black',
  },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'opposite row reached' },
      moves: moves(SOUTH_WINS),
    } satisfies GameTableStory,
  },
};

/** Apply the real rules so interaction stories show the resulting board. */
const renderClassicJourney: NonNullable<Story['render']> = quoridorJourney({
  presentation: quoridorGameClient.presentation,
  sides: TWO_PLAYER_SIDES,
  reason: 'opposite row reached',
  seat: 'fixed',
});

/** Preview and cancel a wall, then place one; the next turn starts with the pawn tool. */
export const PlaceAWall: Story = {
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-mode-h')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-action-d4h'));
    await expectQuoridorWallPreview(canvasElement);
    await expect(
      canvas.getByTestId('custom-game-board-action-d4h')
    ).toHaveAttribute('data-preview-edge-top', 'true');
    await expect(
      canvas.getByTestId('custom-game-board-action-d4h')
    ).toHaveAttribute('data-edge-top', 'false');
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-cancel'));
    await expect(
      canvas.getByTestId('custom-game-board-action-d4h')
    ).toHaveAttribute('data-preview-edge-top', 'false');
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e5h')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
    // regression: quoridor-wall-tool-carries-into-next-turn
    await expect(
      canvas.getByTestId('custom-game-board-mode-move')
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      canvas.getByTestId('custom-game-board-action-e5')
    ).toHaveAccessibleName(/wall boundaries/);
  },
};

/**
 * After e5h, a crossing vertical wall is refused with its reason and a
 * legal one is placed. Its own journey, so each stays inside the story
 * deadline on a throttled phone.
 */
export const RefuseACrossingWall: Story = {
  args: { position: classic('e5h') },
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-mode-v')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-action-e5v'));
    await expect(
      canvas.getByTestId('custom-game-board-wall-status')
    ).toHaveTextContent('crosses another wall');
    await userEvent.click(canvas.getByTestId('custom-game-board-action-b3v'));
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
    await expect(
      canvas.getByTestId('custom-game-board-action-b3')
    ).toHaveAccessibleName(/wall boundaries/);
  },
};

/** Escape cancels a proposal while keeping keyboard focus on its anchor. */
export const KeyboardWallCancellation: Story = {
  render: renderClassicJourney,
  play: ({ canvasElement }) => cancelQuoridorWallWithKeyboard(canvasElement),
};

/** Move the actual pawn onto the opposite edge and observe completion. */
export const ReachOppositeEdge: Story = {
  args: { position: classic(SOUTH_WINS.split(' ').slice(0, -1).join(' ')) },
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e9')
    );
    await expect(
      canvas.getByTestId('custom-game-board-action-e9')
    ).toHaveAccessibleName(/South red circle/);
    await expect(
      canvas.getByTestId('custom-game-board-wall-status')
    ).toHaveTextContent('Game finished');
    await expect(
      canvas.queryByTestId('custom-game-board-mode-move')
    ).not.toBeInTheDocument();
  },
};

/** A refused enclosure preserves the last route, then a legal wall succeeds. */
export const KeepAPathOpen: Story = {
  args: { position: classic('d1h c1v') },
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-mode-v')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-action-e1v'));
    await expect(
      canvas.getByTestId('custom-game-board-wall-status')
    ).toHaveTextContent('last path to the goal');
    await expect(
      canvas.getByTestId('custom-game-board-action-e1v')
    ).toHaveAttribute('data-edge-right', 'false');
    await userEvent.click(canvas.getByTestId('custom-game-board-action-g3v'));
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
    await expect(
      canvas.getByTestId('custom-game-board-action-g3')
    ).toHaveAttribute('data-edge-right', 'true');
  },
};

// regression: quoridor-pawn-prominence-and-identity
export const PawnIdentityAndKeyboard: Story = {
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const pawn = await canvas.findByTestId('custom-game-board-action-e9');
    await expectQuoridorPawnInk(canvasElement, ['e1', 'e9']);
    const glyph = pawn.querySelector('span');
    const view = canvasElement.ownerDocument.defaultView;
    if (!glyph || !view) throw new Error('Pawn rendering is missing');
    await expect(
      parseFloat(view.getComputedStyle(glyph).fontSize)
    ).toBeGreaterThan(pawn.getBoundingClientRect().width * 0.6);
    const gold = view
      .getComputedStyle(pawn)
      .getPropertyValue('--ui-color-game-quoridor-three')
      .trim();
    const encoded = /^#([0-9a-f]{6})$/i.exec(gold)?.[1];
    if (!encoded) throw new Error('Seat color token is missing');
    const expectedChannels = [0, 2, 4].map((offset) =>
      Number.parseInt(encoded.slice(offset, offset + 2), 16)
    );
    const actualChannels = view
      .getComputedStyle(pawn)
      .color.match(/\d+/g)
      ?.map(Number);
    await expect(actualChannels?.slice(0, 3)).toEqual(expectedChannels);
    await userEvent.click(canvas.getByTestId('custom-game-board-action-e2'));
    await expect(
      canvas.getByTestId('custom-game-board-action-e2')
    ).toHaveAccessibleName(/South red circle/);
    await userEvent.keyboard('{ArrowUp}');
    await expect(
      canvas.getByTestId('custom-game-board-action-e3')
    ).toHaveFocus();
  },
};

// regression: quoridor-phone-precise-targets
// regression: quoridor-detached-wall-controls
// regression: quoridor-goal-resembles-wall
export const PreciseCoordinates: Story = {
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await expectQuoridorGoalMarker(canvasElement, 'a9');
    await chooseQuoridorCoordinate(canvasElement, 'e2');
    await expect(
      canvas.getByTestId('custom-game-board-action-e2')
    ).toHaveAccessibleName(/South red circle/);
    await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
    await expectQuoridorSpatialArea(canvasElement);
    await chooseQuoridorCoordinate(canvasElement, 'd4');
    const anchor = canvas.getByTestId('custom-game-board-action-d4h');
    await expect(anchor).toHaveAttribute('data-preview-edge-top', 'true');
    await expect(anchor).toHaveAttribute('data-edge-top', 'false');
    for (const id of ['wall-commit', 'wall-cancel'])
      await expectQuoridorTargetVisible(
        canvas.getByTestId(`custom-game-board-${id}`)
      );
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-cancel'));
    await expect(anchor).toHaveAttribute('data-preview-edge-top', 'false');
    await chooseQuoridorCoordinate(canvasElement, 'd4');
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
    await expect(anchor).toHaveAttribute('data-edge-top', 'true');
  },
};

// regression: quoridor-wall-coordinate-decoding
export const RotateWallPreview: Story = {
  render: renderClassicJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-mode-h'));
    await expectQuoridorSpatialArea(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-action-d4h'));
    await expectQuoridorWallPreview(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-mode-v'));
    await expectQuoridorWallPreview(canvasElement);
    await expect(
      canvas.getByTestId('custom-game-board-action-d4v')
    ).toHaveAttribute('data-preview-edge-right', 'true');
    await expect(
      canvas.getByTestId('custom-game-board-action-d4v')
    ).toHaveAttribute('data-edge-right', 'false');
  },
};
