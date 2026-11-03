import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SoundSettingsScreenView } from './sound-screen-view';

const meta = {
  id: 'screens-settings-sound',
  title: 'Screens/Settings/Sound',
  component: SoundSettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { muted: false, onMutedChange: fn() },
} satisfies Meta<typeof SoundSettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Sound effects play; the switch is on. */
export const On: Story = {};

/** Sound effects are muted; the icon and caption say so, the switch is off. */
export const Muted: Story = { args: { muted: true } };

/** Turning the switch off mutes sound effects. */
export const Mute: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('switch', { name: 'Sound effects' });
    await userEvent.click(target);
    await expect(args.onMutedChange).toHaveBeenCalledWith(true);
  },
};
