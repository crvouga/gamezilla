import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  expectSpaceBarActions,
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  spaceStoryRole,
} from '../../storybook/fixtures/space-story-globals';
import { SpaceLauncher } from './index';
import SpaceLauncherExample, {
  SPACE_EXAMPLE_LAUNCHER_GAMES,
  type SpaceLauncherExampleProps,
} from './space-launcher.example';

type Args = Omit<SpaceLauncherExampleProps, 'role'>;

const meta = {
  id: 'space-choosing',
  title: 'Templates/Space/SpaceLauncher',
  component: SpaceLauncher,
  tags: ['autodocs', 'viewport-responsive'],
  args: {
    onBack: fn(),
    onMembers: fn(),
    onSettings: fn(),
    onMinimize: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onChoose: fn(),
  },
  parameters: { layout: 'fullscreen', controls: { disable: true } },
  render: (args, { globals }) => (
    <SpaceLauncherExample {...args} role={spaceStoryRole(globals)} />
  ),
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/**
 * bob's space while bob chooses a game, seen by the toolbar's role. The
 * host chooses: every tile is selectable, ana's suggestion is marked,
 * Hearts says how bots fill its seats, solo games say so, and tapping a
 * game opens its setup. A guest watches, exactly as in the app's space
 * home: the tiles only show, with how many each seats, and nothing offers
 * the host's bots. The game toolbar does not apply.
 */
export const Screen: Story = {
  parameters: {
    spaceMatrix: {
      games: ['light-cycles'],
      roles: SPACE_STORY_ROLES,
    } satisfies SpaceMatrix,
  },
  play: async ({ args, canvasElement, globals }) => {
    const canvas = within(canvasElement);
    // regression: game-picker-board-art-replaced-with-emoji
    for (const game of SPACE_EXAMPLE_LAUNCHER_GAMES) {
      const tile = canvasElement.querySelector(
        `[data-component="GameTile"][data-motif="${game.motif}"]`
      );
      await expect(tile).toHaveAttribute('aria-hidden', 'true');
      const board = tile?.querySelector('svg');
      await expect(board).toBeVisible();
      await expect(
        board?.querySelectorAll('rect, circle, path, line').length
      ).toBeGreaterThan(1);
    }
    if (spaceStoryRole(globals) === 'host') {
      await expect(
        canvas.getByRole('heading', { name: 'Pick a game for 2 players' })
      ).toBeVisible();
      await expect(canvas.getByText('2 players + 2 bots')).toBeVisible();
      await userEvent.click(
        canvas.getByRole('button', { name: /Light Cycles/ })
      );
      await expect(args.onChoose).toHaveBeenCalledWith('light-cycles');
      await expectSpaceBarActions(canvasElement, 'host');
      return;
    }
    await expect(
      canvas.getByRole('heading', { name: 'bob is choosing a game' })
    ).toBeVisible();
    // A guest reads the host's count for the chosen table.
    await expect(canvas.getByText('2 players + 2 bots')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: /^Chess/ })
    ).toHaveAttribute('aria-disabled', 'true');
    await expectSpaceBarActions(canvasElement, 'guest');
  },
};
