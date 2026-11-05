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
    onGoToSearch: fn(),
    onGoToProfile: fn(),
    onGoBack: fn(),
  },
} satisfies Meta<typeof RouteStubScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * An address with nothing at it, reached from another screen: the title
 * says it once, then, centred in the content area, why and where to go
 * instead: Spaces (home), Search and Profile, and Go back (offered only
 * when the app has a screen to return to). It belongs to no section, so
 * the header shows no parent crumb.
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
