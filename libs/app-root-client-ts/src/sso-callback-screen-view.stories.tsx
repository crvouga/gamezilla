import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SsoCallbackScreenView } from './sso-callback-screen-view';

const meta = {
  id: 'screens-shell-sso-callback',
  title: 'Screens/Shell/Sign-in callback',
  component: SsoCallbackScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
} satisfies Meta<typeof SsoCallbackScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Returning from a hosted sign-in: one indicator until the redirect settles. */
export const SigningIn: Story = {};
