import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { fn } from 'storybook/test';
import {
  createJSXDecorator,
  type Meta,
  type StoryObj,
} from 'storybook-solidjs-vite';
import { IdentityBootScreenView } from './identity-boot-screen-view';

/** Give the session status its normal viewport. */
const withViewport = createJSXDecorator((Story) => (
  <StackVertical minHeight="screen">
    <Story />
  </StackVertical>
));

const meta = {
  id: 'screens-shell-identity-boot',
  title: 'Screens/Shell/Account loading',
  component: IdentityBootScreenView,
  tags: ['autodocs'],
  decorators: [withViewport],
  parameters: { appRouter: true },
  args: { status: 'pending', onReload: fn() },
} satisfies Meta<typeof IdentityBootScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Session status until the account binds. */
export const Pending: Story = {};

/** Binding outlived its deadline: never a hang, always a way forward. */
export const Stuck: Story = { args: { status: 'stuck' } };
