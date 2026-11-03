import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BootLoadingShell } from './boot-loading-shell';

const meta = {
  id: 'screens-shell-boot-loading',
  title: 'Screens/Shell/Boot loading',
  component: BootLoadingShell,
  tags: ['autodocs'],
  parameters: { appRouter: true },
} satisfies Meta<typeof BootLoadingShell>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Identity binding or the local database opening: one centered indicator. */
export const Loading: Story = {};
