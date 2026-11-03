import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { RouteStubScreenView } from './route-stub-screen-view';

const meta = {
  id: 'screens-shell-not-found',
  title: 'Screens/Shell/Not found',
  component: RouteStubScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['title', 'parent'] } },
  args: {
    screenId: 'not-found',
    title: 'Not found',
    notFound: true,
    onGoToSpaces: fn(),
  },
} satisfies Meta<typeof RouteStubScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An address with nothing at it: say so and offer the way home. */
export const NotFound: Story = {};

/**
 * A route not yet built for the web (Settings › Account › Sign-in
 * providers): its real breadcrumbs, a placeholder and the way home.
 */
export const NotYetAvailable: Story = {
  args: {
    screenId: 'account-providers',
    title: 'Sign-in providers',
    parent: { name: 'Account', href: '/more/account' },
    notFound: false,
  },
};

/** "Go to Spaces" leaves for the app's home. */
export const GoToSpaces: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const target = await canvas.findByRole('button', { name: 'Go to Spaces' });
    await userEvent.click(target);
    await expect(args.onGoToSpaces).toHaveBeenCalledOnce();
  },
};
