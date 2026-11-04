import { Avatar } from '@pkgs/ui-root-client-ts/avatar';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AppHeaderIslandView } from './app-header-island-view';
import { STORY_APP_TABS, STORY_LONG_APP_TABS } from './app-tabs-story.example';

const meta = {
  id: 'screens-shell-header-island',
  title: 'Screens/Shell/Header island',
  component: AppHeaderIslandView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    appFrame: false,
    controls: { exclude: ['tabs', 'trailing'] },
  },
  args: { tabs: STORY_APP_TABS, pathname: '/', onSelect: fn() },
} satisfies Meta<typeof AppHeaderIslandView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Wide layouts: logo, the tab pills with Spaces current, no actions. */
export const SpacesCurrent: Story = {};

/** On Search: its pill is the current page. */
export const SearchCurrent: Story = { args: { pathname: '/search' } };

/** On the inbox: the Notifications pill is the current page. */
export const NotificationsCurrent: Story = {
  args: { pathname: '/notifications' },
};

/** A nested route keeps its tab's pill current. */
export const ProfileCurrent: Story = { args: { pathname: '/profile/friends' } };

/** The account face sits at the end, as the global menu's trigger. */
export const WithAccountMenu: Story = {
  render: (args) => (
    <AppHeaderIslandView {...args} trailing={<Avatar size={32} you />} />
  ),
};

/** Long labels: the brand yields to the navigation instead of overlapping. */
export const LongLabels: Story = { args: { tabs: STORY_LONG_APP_TABS } };

/** Pressing a pill hands its tab to the shell to navigate. */
export const SelectProfile: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const profile = await canvas.findByRole('button', { name: 'Profile' });
    await userEvent.click(profile);
    await expect(args.onSelect).toHaveBeenCalledWith(STORY_APP_TABS[3]);
  },
};

/** Wide layouts: the sidebar, Spaces current, the account face at its foot. */
export const SidebarSpacesCurrent: Story = {
  parameters: { appFrame: 'rail' },
  args: { orientation: 'vertical' },
  render: (args) => (
    <AppHeaderIslandView {...args} trailing={<Avatar size={32} you />} />
  ),
};

/** The sidebar on Search. */
export const SidebarSearchCurrent: Story = {
  ...SidebarSpacesCurrent,
  args: { orientation: 'vertical', pathname: '/search' },
};

/** The sidebar on the inbox. */
export const SidebarNotificationsCurrent: Story = {
  ...SidebarSpacesCurrent,
  args: { orientation: 'vertical', pathname: '/notifications' },
};

/** The sidebar on a profile sub-screen: Profile stays current. */
export const SidebarProfileCurrent: Story = {
  ...SidebarSpacesCurrent,
  args: { orientation: 'vertical', pathname: '/profile/friends' },
};
