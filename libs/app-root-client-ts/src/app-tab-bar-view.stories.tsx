import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AppTabBarView } from './app-tab-bar-view';
import { STORY_APP_TABS, STORY_LONG_APP_TABS } from './app-tabs-story.example';

const meta = {
  id: 'screens-shell-tab-bar',
  title: 'Screens/Shell/Tab bar',
  component: AppTabBarView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    appFrame: false,
    controls: { exclude: ['tabs'] },
  },
  args: { tabs: STORY_APP_TABS, pathname: '/', onSelect: fn() },
} satisfies Meta<typeof AppTabBarView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** At home: Spaces is the current page. */
export const SpacesCurrent: Story = {};

/** On Search: its tab is the current page. */
export const SearchCurrent: Story = { args: { pathname: '/search' } };

/** On the inbox: Notifications is the current page. */
export const NotificationsCurrent: Story = {
  args: { pathname: '/notifications' },
};

/** A nested route keeps its tab current (a profile sub-screen → Profile). */
export const ProfileCurrent: Story = { args: { pathname: '/profile/friends' } };

/** A route outside every tab (Settings) marks no tab current. */
export const NoTabCurrent: Story = { args: { pathname: '/more' } };

/** Long localized labels truncate within their tab. */
export const LongLabels: Story = { args: { tabs: STORY_LONG_APP_TABS } };

/** A single composed sub contributes a single tab. */
export const SingleTab: Story = { args: { tabs: STORY_APP_TABS.slice(0, 1) } };

/** Pressing a tab hands its spec to the shell to navigate. */
export const SelectSearch: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const search = await canvas.findByRole('button', { name: 'Search' });
    await userEvent.click(search);
    await expect(args.onSelect).toHaveBeenCalledWith(STORY_APP_TABS[1]);
  },
};
