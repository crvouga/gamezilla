import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { FrameStory } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import { FRAME_CONFIGURING as CONFIGURING } from './game-frame-setup-story.example';
import {
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  setup,
} from './game-frame-story.example';

const COLUMNS = 'ABCDEFGH'.split('');
const ROWS = ['1', '2', '3', '4', '5', '6'];
/** Where the story's placed pieces lie: across row 2 and down column F. */
const PLACED = new Set([9, 10, 11, 12, 21, 29, 37]);
/** Every piece on the board: the short one across row 6 as well. */
const ARRANGED = new Set([...PLACED, 41, 42]);

/**
 * A stand-in for a game's own setup board, as a game draws one: its own
 * line on what is placed and how, the pieces to choose from, and the grid.
 */
function StorySetupBoard(props: { complete: boolean }) {
  const pieces = () => (props.complete ? ARRANGED : PLACED);
  return (
    <StackVertical gap="md" align="center">
      <P variant="label" role="status">
        {props.complete
          ? 'All 3 pieces are placed.'
          : '2 of 3 pieces placed. Choose a piece, then press the cell where it starts.'}
      </P>
      <GameChoiceGrid
        label="Pieces"
        value="short"
        onChange={() => undefined}
        choices={[
          { value: 'long', title: 'Long piece', detail: 'B2, across' },
          { value: 'tall', title: 'Tall piece', detail: 'F3, down' },
          {
            value: 'short',
            title: 'Short piece',
            detail: props.complete ? 'B6, across' : '2 cells',
          },
        ]}
      />
      <CellGridBoard
        label="Your setup"
        testId="story-setup-board"
        columnLabels={COLUMNS}
        rowLabels={ROWS}
        cells={Array.from({ length: 48 }, (_, cell) => ({
          id: String(cell),
          label: pieces().has(cell) ? `Piece ${cell + 1}` : `Empty ${cell + 1}`,
          glyph: pieces().has(cell) ? '■' : '',
          tone: pieces().has(cell) ? ('occupied' as const) : ('open' as const),
          enabled: false,
        }))}
      />
    </StackVertical>
  );
}

const meta = {
  id: 'screens-games-custom-private-setup',
  title: 'Screens/Games/Custom game/Private setup',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: {
    ...frameArgs(),
    ...CONFIGURING,
    place: { screen: 'private-setup' },
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      privateSetup: { complete: false, locked: false },
      start: {
        reason: { kind: 'unready', count: 1 },
        hostStarts: false,
        readiness: { ready: false, blocked: true },
        canStart: true,
      },
    }),
  },
  render: (args) => (
    <FrameStory
      {...args}
      setupBoard={
        <StorySetupBoard
          complete={args.setup?.privateSetup?.complete === true}
        />
      }
    />
  ),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The setup is incomplete: getting ready is held back until it is arranged, or drawn at random. */
export const Incomplete: Story = {};

/** The setup is complete: getting ready with it is the one filled command. */
export const Complete: Story = {
  args: {
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      privateSetup: { complete: true, locked: false },
      start: {
        reason: { kind: 'unready', count: 1 },
        hostStarts: false,
        readiness: { ready: false, blocked: false },
        canStart: true,
      },
    }),
  },
};

/** Ready with it: the setup locks, and taking readiness back unlocks it. */
export const ReadyAndLocked: Story = {
  args: {
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      privateSetup: { complete: true, locked: true },
    }),
  },
};

/** Offline: the setup is locked until the connection returns, and the notice says so. */
export const Offline: Story = {
  args: {
    connection: 'needed',
    setup: setup(CONFIGURING.setup?.seats ?? [], {
      privateSetup: { complete: false, locked: true },
      start: {
        reason: { kind: 'unready', count: 1 },
        hostStarts: false,
        readiness: { ready: false, blocked: true },
        canStart: true,
      },
    }),
  },
};

/** A random setup is one press. */
export const RandomSetup: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-random')
    );
    await expect(args.onRandomSetup).toHaveBeenCalledTimes(1);
  },
};
