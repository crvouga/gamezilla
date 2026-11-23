import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  expectSpaceExitInMenu,
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  spaceStoryRole,
} from '../../storybook/fixtures/space-story-globals';
import { SpaceLauncher } from './index';
import SpaceLauncherExample, {
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
    onSpaceMenu: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onChoose: fn(),
    onSuggest: fn(),
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
 * game opens its setup. A guest watches: tapping suggests, bob's tile is
 * ringed and says "bob is looking". The game toolbar does not apply.
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
    if (spaceStoryRole(globals) === 'host') {
      await expect(
        canvas.getByRole('heading', { name: 'Pick a game for 2 players' })
      ).toBeVisible();
      await expect(canvas.getByText('4 · add 2 bots')).toBeVisible();
      await userEvent.click(
        canvas.getByRole('button', { name: /Light Cycles/ })
      );
      await expect(args.onChoose).toHaveBeenCalledWith('light-cycles');
      await expectSpaceExitInMenu(canvasElement, 'host');
      return;
    }
    await expect(
      canvas.getByRole('heading', { name: 'bob is choosing a game' })
    ).toBeVisible();
    await expect(canvas.getByText('bob is looking')).toBeVisible();
    await expect(canvas.getByText('Needs 4')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /^Chess/ }));
    await expect(args.onSuggest).toHaveBeenCalledWith('chess');
    await expectSpaceExitInMenu(canvasElement, 'guest');
  },
};
