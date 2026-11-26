import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { AdminDashboardScreenView } from './admin-dashboard-screen-view';

const meta = {
  id: 'screens-admin-dashboard',
  title: 'Screens/Admin/Dashboard',
  component: AdminDashboardScreenView,
  parameters: { appRouter: true },
  args: {
    onObservatory: () => undefined,
    onPopulation: () => undefined,
    onPuzzles: () => undefined,
    onSignOut: () => undefined,
  },
} satisfies Meta<typeof AdminDashboardScreenView>;
export default meta;
export const Dashboard: StoryObj<typeof meta> = {};
