import { Show } from 'solid-js';
import { expect, fn, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
// Chess draws its own board, so its moment of this screen is its package's.
import SpaceInGameChessExample from '../../../chess-board-root-client-ts/src/chess-board/space-chess.example';
import {
  SPACE_STORY_GAMES,
  SPACE_STORY_PLAY_FIXTURE,
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  spaceStoryGame,
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
  render: (args, { globals }) => {
    const game = spaceStoryGame(globals);
    const role = spaceStoryRole(globals);
    return (
      <Show
        when={game !== 'chess' && SPACE_STORY_PLAY_FIXTURE[game]}
        fallback={<SpaceInGameChessExample {...args} role={role} />}
      >
        {(fixture) => (
          <SpaceInGameTemplateExample {...args} game={fixture()} role={role} />
        )}
      </Show>
    );
  },
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/**
 * bob's space while the toolbar's game is played, seen by the toolbar's
 * role: player-color rings and each seat's data line, the game's own
 * actions in the action bar, End for the host and Leave for a guest in row
 * 1, and no Invite while a game runs. Pressing a person opens their menu
 * against their avatar. Chess is one of the toolbar's games like the others: its
 * board comes from its own package, at one fixed mid-game moment with the
 * viewer to move.
 */
export const Screen: Story = {
  parameters: {
    spaceMatrix: {
      games: SPACE_STORY_GAMES,
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
