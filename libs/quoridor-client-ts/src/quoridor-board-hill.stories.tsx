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
import { QUORIDOR_SIDES } from '@libs/quoridor-shared-ts/quoridor-rules';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { QuoridorBoard } from './quoridor-board';
import { quoridorHillGameClient } from './quoridor-game-client';
import {
  playHillPreciseCoordinates,
  playHillWallPreview,
} from './quoridor-hill-precision.example';
import {
  expectHillDestinationVisible,
  expectHillPassVisible,
} from './quoridor-hill-visibility.example';
import { quoridorJourney } from './quoridor-journey.example';
import { cancelQuoridorWallWithKeyboard } from './quoridor-keyboard.example';
import {
  chooseQuoridorCoordinate,
  expectQuoridorBoardUsesColumn,
  expectQuoridorGoalMarker,
  expectQuoridorPawnInk,
  expectQuoridorTargetVisible,
} from './quoridor-precision.example';
import {
  expectQuoridorSpatialArea,
  expectQuoridorWallPreview,
} from './quoridor-wall-preview.example';

/** The King of the Hill position after `actions`, South first, then clockwise. */
function hill(actions: readonly string[]): string {
  return encodeQuoridor(replayQuoridor('hill', actions));
}

/**
 * Every wall placed and South boxed in: no move and no wall is legal, so
 * South may only pass.
 */
const BLOCKED = [
  'e2',
  'a4',
  'e8',
  'i6',
  'e1',
  'b4',
  'e7',
  'i5',
  'e2',
  'c4',
  'f7',
  'i6',
  'a1h',
  'd4',
  'f6',
  'i5',
  'c7h',
  'd3',
  'f5',
  'a3h',
  'f7h',
  'e3',
  'f4',
  'c5h',
  'a7v',
  'd2v',
  'e4',
  'g3h',
  'g1h',
  'e2v',
  'd1h',
  'a5v',
];
/** South climbs to the hill while the others step away from it. */
const SOUTH_TAKES_THE_HILL = 'e2 a4 e8 i6 e3 a3 d8 i7 e4 a2 c8 i8 e5'.split(
  ' '
);

const meta = {
  id: 'screens-games-quoridor-hill',
  title: 'Screens/Games/Quoridor/King of the Hill',
  component: QuoridorBoard,
  tags: ['autodocs'],
  render: (args, context) =>
    renderGameTable(
      quoridorHillGameClient.presentation,
      QUORIDOR_SIDES,
      args,
      context
    ),
  parameters: {
    appRouter: true,
    controls: { exclude: [...BOARD_CONTROLS_EXCLUDE] },
    table: { turn: 'white' } satisfies GameTableStory,
  },
  args: boardArgs(hill([]), { interactive: true }),
} satisfies Meta<typeof QuoridorBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Four pawns around the board, five walls each, all heading for e5. */
export const Opening: Story = {
  play: async ({ canvasElement }) => {
    await expectQuoridorSpatialArea(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    await expectQuoridorGoalMarker(canvasElement, 'e5');
    await expectQuoridorPawnInk(canvasElement, ['e1', 'a5', 'e9', 'i5']);
    await expectQuoridorBoardUsesColumn(canvasElement);
  },
};

/** No move or wall is legal: the pass is offered beside the tools. */
export const MustPass: Story = {
  args: { position: hill(BLOCKED) },
  parameters: { table: { moves: BLOCKED } satisfies GameTableStory },
  play: async ({ canvasElement }) => {
    // regression: quoridor-hill-forced-pass-clipped
    await expectHillPassVisible(canvasElement);
  },
};

/** East is deciding while the others wait. */
export const WaitingForOthers: Story = {
  args: { position: hill(['e2', 'a4', 'e8']), interactive: false },
  parameters: {
    table: { turn: 'blue', moves: ['e2', 'a4', 'e8'] } satisfies GameTableStory,
  },
};

/** South reached the hill first and won outright. */
export const Won: Story = {
  args: { position: hill(SOUTH_TAKES_THE_HILL), interactive: false },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'hill reached' },
      moves: SOUTH_TAKES_THE_HILL,
    } satisfies GameTableStory,
  },
};

/** West's view of the same game: placed behind the winner. */
export const Lost: Story = {
  args: {
    position: hill(SOUTH_TAKES_THE_HILL),
    interactive: false,
    orientation: 'black',
  },
  parameters: {
    table: {
      ending: { winner: 'white', reason: 'hill reached' },
      moves: SOUTH_TAKES_THE_HILL,
    } satisfies GameTableStory,
  },
};

/** Every accepted action goes through the production rules and paints a new position. */
const renderHillJourney: NonNullable<Story['render']> = quoridorJourney({
  presentation: quoridorHillGameClient.presentation,
  sides: QUORIDOR_SIDES,
  reason: 'hill reached',
  seat: 'turn',
});

/** Coordinate choices advance the same four-player production-rule fixture. */
export const PreciseCoordinates: Story = {
  render: renderHillJourney,
  play: ({ canvasElement }) => playHillPreciseCoordinates(canvasElement),
};

/** After every pawn has moved once, the picker previews, rotates, cancels and places a d4 wall. */
export const PreciseWallPreview: Story = {
  args: { position: hill(['e2', 'a4', 'e8', 'i6']) },
  render: renderHillJourney,
  play: ({ canvasElement }) => playHillWallPreview(canvasElement),
};

/** The four-player board offers the same keyboard proposal cancellation. */
export const KeyboardWallCancellation: Story = {
  render: renderHillJourney,
  play: ({ canvasElement }) => cancelQuoridorWallWithKeyboard(canvasElement),
};

/** Passing changes the active pawn and removes the forced-pass action. */
export const PassAndContinue: Story = {
  args: { position: hill(BLOCKED) },
  render: renderHillJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // regression: quoridor-hill-forced-pass-clipped
    const pass = await expectHillPassVisible(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    pass.focus({ preventScroll: true });
    await expect(pass).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(
      canvas.queryByTestId('custom-game-board-action-pass')
    ).not.toBeInTheDocument();
    await expect(
      await canvas.findByTestId('custom-game-board-action-e5')
    ).toBeEnabled();
    await expectQuoridorSpatialArea(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e5')
    );
    await expect(
      await canvas.findByTestId('custom-game-board-action-e5')
    ).toHaveAccessibleName(/West gold diamond/);
    await expect(
      canvas.getByTestId('custom-game-board-action-e5')
    ).toHaveTextContent('◆');
    await expect(
      canvas.getByTestId('custom-game-board-action-e5')
    ).not.toHaveTextContent('★');
  },
};

/** Each of the four pawns moves, then South places a wall. */
export const FourPlayerRound: Story = {
  render: renderHillJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    for (const [square, pawn] of [
      ['e2', 'South red circle'],
      ['a4', 'West gold diamond'],
      ['e8', 'North green triangle'],
      ['i6', 'East black square'],
    ] as const) {
      await expectQuoridorSpatialArea(canvasElement);
      await expectHillDestinationVisible(canvasElement);
      await userEvent.click(
        await canvas.findByTestId(`custom-game-board-action-${square}`)
      );
      await expect(
        await canvas.findByTestId(`custom-game-board-action-${square}`)
      ).toHaveAccessibleName(new RegExp(pawn));
    }
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-mode-h')
    );
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e5h')
    );
    await expect(
      await canvas.findByTestId('custom-game-board-wall-status')
    ).toHaveTextContent(/Preview only. Place wall to confirm/);
    // regression: quoridor-hill-four-seat-confirm-below-fold
    await expectQuoridorWallPreview(canvasElement);
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-cancel'));
    await expect(
      canvas.queryByTestId('custom-game-board-wall-cancel')
    ).not.toBeInTheDocument();
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e5h')
    );
    await expectQuoridorWallPreview(canvasElement);
    await expectQuoridorTargetVisible(
      canvas.getByTestId('custom-game-board-wall-commit')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
    await expect(
      await canvas.findByTestId('custom-game-board-action-a3')
    ).toBeEnabled();
    const moves = canvasElement.querySelectorAll<HTMLElement>(
      '[data-component="GameMoveList"] button'
    );
    await expect(moves.length).toBeGreaterThan(0);
    for (const move of moves) {
      const view = move.ownerDocument.defaultView;
      if (!view) throw new Error('Missing record window');
      const text = move.ownerDocument.createRange();
      text.selectNodeContents(move);
      await expect(text.getClientRects()).toHaveLength(1);
      await expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(
        move.clientWidth
      );
      await expect(move.scrollWidth).toBeLessThanOrEqual(move.clientWidth);
    }
  },
};

/** The final step onto the hill paints the pawn and displays the result. */
export const ReachTheHill: Story = {
  args: { position: hill(SOUTH_TAKES_THE_HILL.slice(0, -1)) },
  render: renderHillJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-action-e5')
    );
    await expect(
      await canvas.findByTestId('custom-game-board-action-e5')
    ).toHaveAccessibleName(/South red circle/);
    await expect(
      canvas.getByTestId('custom-game-board-action-e5')
    ).toHaveTextContent('●');
    await expect(
      canvas.getByTestId('custom-game-board-action-e5')
    ).not.toHaveTextContent('★');
    await expect(await canvas.findByText('avery wins')).toBeVisible();
    await expect(
      canvas.queryByTestId('custom-game-board-tools')
    ).not.toBeInTheDocument();
  },
};

/** An overlapping wall is refused; a different anchor completes the turn. */
export const RecoverWallPlacement: Story = {
  args: { position: hill(['e5h']) },
  render: renderHillJourney,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expectQuoridorSpatialArea(canvasElement);
    await expectHillDestinationVisible(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-board-mode-h')
    );
    await chooseQuoridorCoordinate(canvasElement, 'e5');
    await expect(
      await canvas.findByTestId('custom-game-board-wall-status')
    ).toHaveTextContent(/overlaps/);
    await expectQuoridorWallPreview(canvasElement, { refused: true });
    await chooseQuoridorCoordinate(canvasElement, 'a1');
    await expectQuoridorWallPreview(canvasElement);
    await expectQuoridorTargetVisible(
      canvas.getByTestId('custom-game-board-wall-commit')
    );
    await userEvent.click(canvas.getByTestId('custom-game-board-wall-commit'));
    await expect(
      await canvas.findByTestId('custom-game-board-action-e8')
    ).toBeEnabled();
  },
};
