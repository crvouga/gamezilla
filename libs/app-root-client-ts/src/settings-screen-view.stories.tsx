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
    offline: false,
    canViewBilling: false,
    version: '1.0.0',
    bugReportsWaiting: 0,
    shakeToReport: 'unavailable',
    onShakeToReportChange: fn(),
    onAllowShakeToReport: fn(),
    onReportBug: fn(),
    onOfflineChange: fn(),
    onNavigate: fn(),
  },
} satisfies Meta<typeof SettingsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Defaults: online, system appearance, sound on, monitor off, no billing.
 * Everyday groups lead; About and Troubleshooting close the page, each a
 * page of its own behind a right chevron.
 */
export const Default: Story = {};

/** Billing is offered when the person may view it. */
export const WithBilling: Story = { args: { canViewBilling: true } };

/** Every preference away from its default, as its row values say. */
export const PreferencesChanged: Story = {
  args: { theme: 'dark', muted: true, offline: true },
};

/** Sections the composed subs contribute follow the everyday groups. */
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

/** On a phone, shaking opens a bug report unless the person turns it off. */
export const ShakeToReport: Story = { args: { shakeToReport: 'on' } };

/** A phone that asks first: on, with a row that has the phone ask the person. */
export const AllowShakeToReport: Story = {
  args: { shakeToReport: 'needs-permission' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByText('Allow shaking');
    await userEvent.click(target);
    await expect(args.onAllowShakeToReport).toHaveBeenCalled();
  },
};

/** A phone that refused says a bug can still be reported from here. */
export const ShakeToReportRefused: Story = {
  args: { shakeToReport: 'refused' },
};

/** Bug reports that could not be sent yet are counted on the row. */
export const BugReportsWaiting: Story = { args: { bugReportsWaiting: 2 } };

/** Report a bug opens the bug report. */
export const ReportBug: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByText('Report a bug');
    await userEvent.click(target);
    await expect(args.onReportBug).toHaveBeenCalled();
  },
};

/** Turning the switch back on is also where a phone asks to notice motion. */
export const TurnOnShakeToReport: Story = {
  args: { shakeToReport: 'off' },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('switch', {
      name: 'Shake to report a bug',
    });
    await userEvent.click(target);
    await expect(args.onShakeToReportChange).toHaveBeenCalledWith(true);
  },
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

/** Troubleshooting opens its page of diagnostics, like every other row. */
export const OpenTroubleshooting: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const troubleshooting = await canvas.findByText('Troubleshooting');
    await userEvent.click(troubleshooting);
    await expect(args.onNavigate).toHaveBeenCalledWith('/more/troubleshooting');
  },
};
