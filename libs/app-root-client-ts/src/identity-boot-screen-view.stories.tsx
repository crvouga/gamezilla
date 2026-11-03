import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { IdentityBootScreenView } from './identity-boot-screen-view';

const meta = {
  id: 'screens-shell-identity-boot',
  title: 'Screens/Shell/Account loading',
  component: IdentityBootScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { status: 'pending', onReload: fn() },
} satisfies Meta<typeof IdentityBootScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The account normally binds at once; until then, the one boot indicator. */
export const Pending: Story = {};

/** Binding outlived its deadline: never a hang, always a way forward. */
export const Stuck: Story = { args: { status: 'stuck' } };
