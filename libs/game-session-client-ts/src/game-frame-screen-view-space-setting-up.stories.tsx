import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { GameFrameScreenView } from './game-frame-screen-view';
import Lobby, {
  GuestSeated,
  HostWithOptions,
} from './game-frame-screen-view.lobby.stories';

/**
 * The design system's Spaces table, Setting up row: the chosen game's own
 * setup, once per role. The states are the custom game lobby's own
 * stories (`Screens/Games/Custom game/Lobby`).
 */
const meta = {
  id: 'space-setting-up',
  title: 'Space/Setting up',
  component: GameFrameScreenView,
  tags: ['autodocs', 'viewport-responsive'],
  parameters: Lobby.parameters,
  args: Lobby.args,
  render: Lobby.render,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host sets the game up: seats, the game's options and the clock, each behind its own row. */
export const Host: Story = { ...HostWithOptions };

/** A seated guest: the host's choices are theirs to read, and getting ready is their one command. */
export const Guest: Story = { ...GuestSeated };
