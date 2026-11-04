import { BOOT_GLOBAL_MENU_IDENTITY } from '@libs/app-env-client-ts/global-menu-identity-context';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  createJSXDecorator,
  type Meta,
  type StoryObj,
} from 'storybook-solidjs-vite';
import { AppHeaderGlobalMenuView } from './app-header-global-menu-view';

const SIGNED_IN = {
  usernameLabel: '@avery',
  email: 'avery@example.test',
  avatar: null,
};

/** The menu sits at the header's end; the frame leaves room for it to open. */
const withHeaderEnd = createJSXDecorator((Story) => (
  <StackVertical minHeight="screen" align="end" paddingX="md" paddingTop="sm">
    <Story />
  </StackVertical>
));

const meta = {
  id: 'screens-shell-account-menu',
  title: 'Screens/Shell/Account menu',
  component: AppHeaderGlobalMenuView,
  tags: ['autodocs'],
  decorators: [withHeaderEnd],
  parameters: {
    appRouter: true,
    appFrame: false,
    controls: { exclude: ['identity'] },
  },
  args: {
    identity: SIGNED_IN,
    connectivity: 'online',
    theme: 'system',
    muted: false,
    onNavigate: fn(),
  },
} satisfies Meta<typeof AppHeaderGlobalMenuView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Opens the menu from its trigger and waits for the Connectivity row. */
async function openMenu(canvasElement: HTMLElement, status: string) {
  const canvas = within(canvasElement.ownerDocument.body);
  const trigger = await canvas.findByRole('button', { name: 'Account menu' });
  await userEvent.click(trigger);
  const connectivity = await canvas.findByRole('menuitem', {
    name: `Connectivity ${status}`,
  });
  await expect(connectivity).toBeVisible();
}

/** Closed: only the account face shows in the header. */
export const Closed: Story = {};

/** Open for a named account: the header names them, rows show live status. */
export const Open: Story = {
  play: ({ canvasElement }) => openMenu(canvasElement, 'Online'),
};

/** Before anyone is published (boot), the header falls back to "Account". */
export const OpenWithoutIdentity: Story = {
  args: {
    identity: BOOT_GLOBAL_MENU_IDENTITY,
    connectivity: 'warning',
    theme: 'dark',
    muted: true,
  },
  play: ({ canvasElement }) => openMenu(canvasElement, 'Sync issue'),
};
