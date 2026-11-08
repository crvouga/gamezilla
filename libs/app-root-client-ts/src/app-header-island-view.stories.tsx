import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { STORY_SIGNED_IN_IDENTITY } from './account-face-story.example';
import { AppHeaderGlobalMenuView } from './app-header-global-menu-view';
import { AppHeaderIslandView } from './app-header-island-view';
import { STORY_APP_TABS, STORY_LONG_APP_TABS } from './app-tabs-story.example';

const meta = {
  id: 'screens-shell-header-island',
  title: 'Screens/Shell/Header island',
  component: AppHeaderIslandView,
  // The production shell mounts this only in wide layouts; phones use AppTabBar.
  tags: ['autodocs', 'viewport-desktop'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
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

/**
 * The global account menu as the shell mounts it: the signed-in person's
 * face (their name too, in the sidebar) opening Settings, Connectivity,
 * Account, Theme and Sound.
 */
function accountMenu(showName: boolean) {
  return (
    <AppHeaderGlobalMenuView
      identity={STORY_SIGNED_IN_IDENTITY}
      connectivity="online"
      theme="system"
      muted={false}
      onNavigate={fn()}
      showName={showName}
    />
  );
}

/** The person's face sits at the end, as the global menu's trigger. */
export const WithAccountMenu: Story = {
  render: (args) => (
    <AppHeaderIslandView {...args} trailing={accountMenu(false)} />
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

/**
 * Wide layouts: the sidebar, Spaces current, and at its foot the account
 * menu as the person's face and name ("@avery"), so it reads as who is
 * signed in rather than a second Profile row. The menu is named by the name
 * it shows (WCAG 2.5.3).
 */
export const SidebarSpacesCurrent: Story = {
  tags: ['viewport-desktop'],
  globals: { viewport: { value: 'desktop', isRotated: false } },
  parameters: { appFrame: 'rail' },
  args: { orientation: 'vertical' },
  render: (args) => (
    <AppHeaderIslandView {...args} trailing={accountMenu(true)} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const menu = await canvas.findByRole('button', {
      name: '@avery, account menu',
    });
    await expect(menu).toBeVisible();
  },
};

/** The sidebar on Search. */
export const SidebarSearchCurrent: Story = {
  ...SidebarSpacesCurrent,
  tags: ['viewport-desktop'],
  args: { orientation: 'vertical', pathname: '/search' },
};

/** The sidebar on the inbox. */
export const SidebarNotificationsCurrent: Story = {
  ...SidebarSpacesCurrent,
  tags: ['viewport-desktop'],
  args: { orientation: 'vertical', pathname: '/notifications' },
};

/** The sidebar on a profile sub-screen: Profile stays current. */
export const SidebarProfileCurrent: Story = {
  ...SidebarSpacesCurrent,
  tags: ['viewport-desktop'],
  args: { orientation: 'vertical', pathname: '/profile/friends' },
};

/** The sidebar on a page outside every tab (a missing page): none current. */
export const SidebarNoneCurrent: Story = {
  ...SidebarSpacesCurrent,
  tags: ['viewport-desktop'],
  args: { orientation: 'vertical', pathname: '/no-such-page' },
};
