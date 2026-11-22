import { expect, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  SPACE_STORY_PLAY_FIXTURE,
  SPACE_STORY_PLAY_GAMES,
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  spaceStoryPlayGame,
  spaceStoryRole,
} from '../../storybook/fixtures/space-story-globals';
import { SpaceInGameTemplate } from './index';
import SpaceInGameTemplateExample, {
  type SpaceInGameTemplateExampleProps,
} from './space-in-game-template.example';

type Args = Omit<SpaceInGameTemplateExampleProps, 'game' | 'role'>;

const meta = {
  id: 'space-in-game',
  title: 'Space/InGame',
  component: SpaceInGameTemplate,
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
    <SpaceInGameTemplateExample
      {...args}
      game={SPACE_STORY_PLAY_FIXTURE[spaceStoryPlayGame(globals)]}
      role={spaceStoryRole(globals)}
    />
  ),
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/**
 * bob's space while the toolbar's game is played, seen by the toolbar's
 * role: player-color rings and each seat's data line, the game's own
 * actions in the action bar, End for the host and Leave for a guest in row
 * 1, and no Invite while a game runs. Pressing a person opens their sheet
 * over the stage. Chess draws its own board, so Chess in play is
 * `Space/InGameChess`, in its own package.
 */
export const Screen: Story = {
  parameters: {
    spaceMatrix: {
      games: SPACE_STORY_PLAY_GAMES,
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
