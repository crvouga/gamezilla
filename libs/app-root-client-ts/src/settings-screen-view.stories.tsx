import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { MenuSection } from '@pkgs/ui-root-client-ts/menu-section';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SettingsScreenView } from './settings-screen-view';

const meta = {
  id: 'screens-settings-index',
  title: 'Screens/Settings/Settings',
  component: SettingsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['subSettings'] } },
  args: {
    theme: 'system',
    muted: false,
    perfEnabled: false,
    offline: false,
    canViewBilling: false,
    version: '1.0.0',
    onOfflineChange: fn(),
    onNavigate: fn(),
  },
} satisfies Meta<typeof SettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Defaults: online, system appearance, sound on, monitor off, no billing. */
export const Default: Story = {};

/** Billing is offered when the person may view it. */
export const WithBilling: Story = { args: { canViewBilling: true } };

/** Every preference away from its default, as its row values say. */
export const PreferencesChanged: Story = {
  args: { theme: 'dark', muted: true, perfEnabled: true, offline: true },
};

/** Sections the composed subs contribute follow the shell's own groups. */
export const WithSubSettings: Story = {
  render: (args) => (
    <SettingsScreenView
      {...args}
      subSettings={
        <MenuSection title="Puzzles">
          <MenuRow title="Puzzle feed" caption="Which puzzles you are shown" />
        </MenuSection>
      }
    />
  ),
};

/** The Work offline switch asks to stop every connection. */
export const WorkOffline: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('switch', { name: 'Work offline' });
    await userEvent.click(target);
    await expect(args.onOfflineChange).toHaveBeenCalledWith(true);
  },
};

/** A row opens its sub-screen. */
export const OpenAppearance: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByText('Appearance');
    await userEvent.click(target);
    await expect(args.onNavigate).toHaveBeenCalledWith('/more/theme');
  },
};
