import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { onBoard } from './game-frame-board.example';
import { GameFrameScreenView } from './game-frame-screen-view';
import Play, { VersusCount } from './game-frame-screen-view.play.stories';
import { GUEST_SEAT_VIEW } from './game-frame-space-story.example';

/**
 * The design system's Spaces table, Starting row: the versus card counts
 * the game in over the board, once per seat. The card puts the viewer's
 * own seat below, so the host and the guest each see their own. The host's
 * state is the custom game's own story (`Screens/Games/Custom game/Play`,
 * Versus count).
 */
const meta = {
  id: 'space-starting',
  title: 'Space/Starting',
  component: GameFrameScreenView,
  tags: ['autodocs', 'viewport-responsive', 'viewport-native-height'],
  parameters: Play.parameters,
  args: { ...Play.args, ...VersusCount.args },
  render: (args) => onBoard([])(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host's count: their own seat on the lower band, the guest's above. */
export const Host: Story = {};

/** The guest's count: the same card, with the guest's seat on the lower band. */
export const Guest: Story = { args: GUEST_SEAT_VIEW };
