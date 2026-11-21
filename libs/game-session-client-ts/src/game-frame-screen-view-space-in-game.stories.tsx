import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { onBoard } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import Play from './game-frame-screen-view.play.stories';
import { FRAME_PLAYING_GUEST } from './game-frame-space-story.example';
import { MID_GAME_MOVES } from './game-frame-story.example';

/**
 * The design system's Spaces table, In game row: the game itself, once per
 * role. The host created the game, so they may still cancel it; the guest
 * may only resign. The states are the custom game's own play stories
 * (`Screens/Games/Custom game/Play`).
 */
const meta = {
  id: 'space-in-game',
  title: 'Space/In game',
  component: GameFrameScreenView,
  tags: ['autodocs', 'viewport-responsive', 'viewport-native-height'],
  parameters: Play.parameters,
  args: Play.args,
  render: (args) => onBoard(MID_GAME_MOVES)(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host to move: their seat below the board, and cancelling the game is still theirs. */
export const Host: Story = {
  args: {
    play: {
      ...FRAME_NO_PLAY,
      canOfferDraw: true,
      canResign: true,
      canCancel: true,
    },
  },
};

/** The guest waits for the host's move: their own seat below the board, the host's above. */
export const Guest: Story = { args: FRAME_PLAYING_GUEST };
