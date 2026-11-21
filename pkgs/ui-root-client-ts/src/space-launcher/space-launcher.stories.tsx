import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SpaceLauncher } from './index';
import Example, {
  type SpaceLauncherExampleProps,
} from './space-launcher.example';

const meta = {
  id: 'space-choosing',
  title: 'Space/Choosing',
  component: SpaceLauncher,
  tags: ['autodocs'],
  args: {
    role: 'host',
    onBack: fn(),
    onSettings: fn(),
    onLeave: fn(),
    onEnd: fn(),
    onPersonAction: fn(),
    onInvite: fn(),
    onChoose: fn(),
    onSuggest: fn(),
  },
  argTypes: {
    role: { control: 'inline-radio', options: ['host', 'guest'] },
  },
  parameters: { layout: 'fullscreen', controls: { include: ['role'] } },
  render: (args) => <Example {...args} />,
} satisfies Meta<SpaceLauncherExampleProps>;
export default meta;

type Story = StoryObj<SpaceLauncherExampleProps>;

/**
 * The host chooses: every tile is selectable, ana's suggestion is marked,
 * Hearts says how bots fill its seats, solo games are dimmed. Use it for
 * the host's launcher; tapping a game opens its setup.
 */
export const Host: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'Pick a game for 2 players' })
    ).toBeVisible();
    await expect(canvas.getByText('4 · add 2 bots')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /Light Cycles/ }));
    await expect(args.onChoose).toHaveBeenCalledWith('light-cycles');
    await expect(canvas.getByRole('button', { name: 'End' })).toBeVisible();
  },
};

/**
 * A guest watches bob choose: tapping suggests, bob's tile is ringed and
 * says "bob is looking", the guest's own suggestion is pressed.
 */
export const Guest: Story = {
  args: { role: 'guest' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('heading', { name: 'bob is choosing a game' })
    ).toBeVisible();
    await expect(canvas.getByText('bob is looking')).toBeVisible();
    await expect(canvas.getByText('Needs 4')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /^Chess/ }));
    await expect(args.onSuggest).toHaveBeenCalledWith('chess');
    await expect(canvas.getByRole('button', { name: 'Leave' })).toBeVisible();
  },
};
