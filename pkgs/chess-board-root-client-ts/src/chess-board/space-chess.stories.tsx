import { expect, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  spaceStoryRole,
} from '../../../ui-root-client-ts/storybook/fixtures/space-story-globals';
import { ChessBoard } from './index';
import SpaceInGameChessExample, {
  type SpaceInGameChessExampleProps,
} from './space-chess.example';

type Args = Omit<SpaceInGameChessExampleProps, 'role'>;

const meta = {
  id: 'space-in-game-chess',
  title: 'Space/InGameChess',
  component: ChessBoard,
  tags: ['autodocs', 'viewport-responsive'],
  args: {
    onBack: fn(),
    onSettings: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onGameAction: fn(),
  },
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  render: (args, { globals }) => (
    <SpaceInGameChessExample {...args} role={spaceStoryRole(globals)} />
  ),
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/**
 * bob's space while Chess is played, seen by the toolbar's role: the real
 * board in the in-game template, at one fixed mid-game moment with the
 * viewer to move. `@pkgs/ui` cannot draw the chess board, so this moment of
 * `Space/InGame` lives here. The game toolbar does not apply.
 */
export const Screen: Story = {
  parameters: {
    spaceMatrix: {
      games: ['chess'],
      roles: SPACE_STORY_ROLES,
    } satisfies SpaceMatrix,
  },
  play: async ({ canvasElement, globals }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('button', {
        name: spaceStoryRole(globals) === 'host' ? 'End' : 'Leave',
      })
    ).toBeVisible();
    await expect(
      canvas.queryByRole('button', { name: 'Invite' })
    ).not.toBeInTheDocument();
  },
};
