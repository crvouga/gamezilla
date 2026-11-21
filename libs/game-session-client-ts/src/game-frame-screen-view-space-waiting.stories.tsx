import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { GameFrameScreenView } from './game-frame-screen-view';
import Lobby, {
  MemberMayTakeSeat,
  WaitingForPlayers,
} from './game-frame-screen-view.lobby.stories';

/**
 * The design system's Spaces table, Waiting for players row: the lobby
 * with a seat still open, once per role. The states are the custom game
 * lobby's own stories (`Screens/Games/Custom game/Lobby`).
 */
const meta = {
  id: 'space-waiting-for-players',
  title: 'Space/Waiting for players',
  component: GameFrameScreenView,
  tags: ['autodocs', 'viewport-responsive'],
  parameters: Lobby.parameters,
  args: Lobby.args,
  render: Lobby.render,
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The host waits on an open seat: inviting or a bot fills it, and Start says why it is held back. */
export const Host: Story = { ...WaitingForPlayers };

/** A guest sees the same seats: Take a seat is the one filled command, or they stay to watch. */
export const Guest: Story = { ...MemberMayTakeSeat };
