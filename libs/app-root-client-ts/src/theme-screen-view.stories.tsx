import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ThemeSettingsScreenView } from './theme-screen-view';

const meta = {
  id: 'screens-settings-appearance',
  title: 'Screens/Settings/Appearance',
  component: ThemeSettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { preference: 'system', onSelect: fn() },
} satisfies Meta<typeof ThemeSettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The default: the app follows the device's appearance. */
export const System: Story = {};

/** Light chosen explicitly; only its row carries the check. */
export const Light: Story = { args: { preference: 'light' } };

/** Dark chosen explicitly; only its row carries the check. */
export const Dark: Story = { args: { preference: 'dark' } };

/** Pressing an option hands its key to the preference, without reflowing rows. */
export const ChooseDark: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByText('Dark');
    await userEvent.click(target);
    await expect(args.onSelect).toHaveBeenCalledWith('dark');
  },
};
