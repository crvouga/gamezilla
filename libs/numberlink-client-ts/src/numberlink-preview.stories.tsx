import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { NumberlinkPreview } from './numberlink-player';
import { FIVE_BY_FIVE } from './numberlink-player.example';

const meta = {
  id: 'screens-games-numberlink-preview',
  title: 'Screens/Games/Numberlink/Preview',
  component: NumberlinkPreview,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { definition: JSON.stringify(FIVE_BY_FIVE) },
} satisfies Meta<typeof NumberlinkPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The puzzle as published: endpoints only, no paths. */
export const Default: Story = {};
