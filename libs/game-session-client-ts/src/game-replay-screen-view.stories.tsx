import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { WON_LINE, WON_MOVES } from './game-frame-story.example';
import {
  GameReplayScreenView,
  type GameReplayScreenViewProps,
} from './game-replay-screen-view';

/** The replay with Connect Four's board at the move shown. */
function atPly(args: GameReplayScreenViewProps) {
  const moves = WON_MOVES.slice(0, args.ply);
  return (
    <GameReplayScreenView
      {...args}
      position={`fixture:${String(args.ply)}`}
      board={
        <ConnectFourStoryBoard
          moves={moves}
          winning={args.ply === WON_MOVES.length ? WON_LINE : undefined}
        />
      }
    />
  );
}

const meta = {
  id: 'screens-games-frame-replay',
  title: 'Screens/Games/Frame/Game replay',
  component: GameReplayScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['board', 'position'] },
  },
  args: {
    ply: WON_MOVES.length,
    moves: WON_MOVES.length,
    label: 'Red circle wins by four in a row.',
    position: '',
    board: null,
    onPrevious: fn(),
    onNext: fn(),
  },
  render: atPly,
} satisfies Meta<typeof GameReplayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A replay opens on the final position; Next is held back at the end. */
export const FinalPosition: Story = {};

/** Stepping back through the game: both directions are open. */
export const MidGame: Story = { args: { ply: 3 } };

/** The starting position: Previous is held back. */
export const Start: Story = { args: { ply: 0 } };
