import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { TroubleshootingScreenView } from './troubleshooting-screen-view';

const meta = {
  id: 'screens-settings-troubleshooting',
  title: 'Screens/Settings/Troubleshooting',
  component: TroubleshootingScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { perfEnabled: false, onNavigate: fn() },
} satisfies Meta<typeof TroubleshootingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The diagnostics, one page each: Connection, Sync, Client config and
 * Performance (its row says whether the monitor is on).
 */
export const Default: Story = {};

/** The performance monitor is on, as its row says. */
export const MonitorOn: Story = { args: { perfEnabled: true } };

/** A row opens its diagnostics screen. */
export const OpenConnection: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText('Connection'));
    await expect(args.onNavigate).toHaveBeenCalledWith('/more/server-status');
  },
};
