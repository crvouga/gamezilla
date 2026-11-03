import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ClientEventsScreenView } from './client-events-screen-view';

const meta = {
  id: 'screens-inspector-client-events',
  title: 'Screens/Inspector/Client events',
  component: ClientEventsScreenView,
  tags: ['autodocs'],
  parameters: { appRouter: true },
} satisfies Meta<typeof ClientEventsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The standalone app has no event stream; it points at the product harness. */
export const Unavailable: Story = {};
