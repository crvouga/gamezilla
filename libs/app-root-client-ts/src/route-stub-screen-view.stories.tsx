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
    parent: { name: 'Spaces', href: '/' },
    notFound: true,
    onGoToSpaces: fn(),
    onGoBack: fn(),
  },
} satisfies Meta<typeof RouteStubScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An address with nothing at it, reached from another screen: say so, offer
 * the way home, and the way back (offered only when the app has a screen to
 * return to). Spaces is its parent, so the header leads back there too (a
 * back chevron on a phone, a breadcrumb beside the sidebar).
 */
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

/** "Go back" returns where the person was; "Go to Spaces" leaves for home. */
export const GoToSpaces: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    const back = await canvas.findByRole('button', { name: 'Go back' });
    await userEvent.click(back);
    await expect(args.onGoBack).toHaveBeenCalledOnce();
    const target = await canvas.findByRole('button', { name: 'Go to Spaces' });
    await userEvent.click(target);
    await expect(args.onGoToSpaces).toHaveBeenCalledOnce();
  },
};
