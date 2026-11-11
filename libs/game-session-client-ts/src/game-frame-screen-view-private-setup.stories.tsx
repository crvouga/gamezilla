import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
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
const ROWS = COLUMNS.map((_, row) => String(row + 1));
/** Where the story's three pieces lie: across row 2, down column F, across row 7. */
const SHIPS = new Set([9, 10, 11, 12, 29, 37, 45, 49, 50]);

/** A stand-in for a game's own setup board: pieces being placed on a grid. */
function StorySetupBoard() {
  return (
    <CellGridBoard
      fill
      label="Your setup"
      testId="story-setup-board"
      columnLabels={COLUMNS}
      rowLabels={ROWS}
      cells={Array.from({ length: 64 }, (_, cell) => ({
        id: String(cell),
        label: SHIPS.has(cell) ? `Piece ${cell + 1}` : `Empty ${cell + 1}`,
        glyph: SHIPS.has(cell) ? '■' : '',
        tone: SHIPS.has(cell) ? ('occupied' as const) : ('open' as const),
        enabled: false,
      }))}
    />
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
  render: (args) => <FrameStory {...args} setupBoard={<StorySetupBoard />} />,
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
