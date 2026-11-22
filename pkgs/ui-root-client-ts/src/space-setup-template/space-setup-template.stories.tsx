import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  SPACE_STORY_FIXTURE,
  SPACE_STORY_GAMES,
  SPACE_STORY_ROLES,
  type SpaceMatrix,
  spaceStoryGame,
  spaceStoryRole,
} from '../../storybook/fixtures/space-story-globals';
import { SpaceSetupTemplate } from './index';
import SpaceSetupTemplateExample, {
  type SpaceSetupTemplateExampleProps,
} from './space-setup-template.example';

type Args = Omit<SpaceSetupTemplateExampleProps, 'game' | 'role' | 'ready'> & {
  /** Whether ana said she is ready; unset, she is ready for the host only. */
  ready?: boolean | undefined;
};

const meta = {
  id: 'space-setting-up',
  title: 'Space/SettingUp',
  component: SpaceSetupTemplate,
  tags: ['autodocs', 'viewport-responsive'],
  args: {
    onBack: fn(),
    onSettings: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onReadyChange: fn(),
    onStart: fn(),
    onChangeGame: fn(),
    onGameAction: fn(),
  },
  argTypes: { ready: { control: 'boolean' } },
  parameters: { layout: 'fullscreen', controls: { include: ['ready'] } },
  render: (args, { globals }) => {
    const role = spaceStoryRole(globals);
    return (
      <SpaceSetupTemplateExample
        {...args}
        game={SPACE_STORY_FIXTURE[spaceStoryGame(globals)]}
        role={role}
        ready={args.ready ?? role === 'host'}
      />
    );
  },
} satisfies Meta<Args>;
export default meta;

type Story = StoryObj<Args>;

/**
 * bob's space while bob sets up the toolbar's game, seen by the toolbar's
 * role. The host sets it up with the game's own controls and starts it
 * once everyone is ready; a guest sees the settings read-only, each
 * player's seat on the data line, and I'm ready as the one action. Hearts
 * fills its empty seats with bots.
 */
export const Screen: Story = {
  parameters: {
    spaceMatrix: {
      games: SPACE_STORY_GAMES,
      roles: SPACE_STORY_ROLES,
    } satisfies SpaceMatrix,
  },
  play: async ({ args, canvasElement, globals }) => {
    const canvas = within(canvasElement);
    if (spaceStoryRole(globals) === 'host') {
      await userEvent.click(canvas.getByRole('button', { name: /^Start / }));
      await expect(args.onStart).toHaveBeenCalledTimes(1);
      await expect(canvas.getByRole('button', { name: 'End' })).toBeVisible();
      return;
    }
    await expect(
      canvas.getByRole('heading', { name: /^bob is setting up / })
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: "I'm ready" }));
    await expect(args.onReadyChange).toHaveBeenCalledWith(true);
    await expect(canvas.getByRole('button', { name: 'Leave' })).toBeVisible();
  },
};
