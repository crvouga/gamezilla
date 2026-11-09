import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanPreview } from './sokoban-player';
import { TWO_CRATES } from './sokoban-player.example';

const meta = {
  id: 'screens-games-sokoban-preview',
  title: 'Screens/Games/Sokoban/Preview',
  component: SokobanPreview,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: { definition: TWO_CRATES },
  // As a builder shows it: in the page's own gutter, not against the bar.
  render: (args) => (
    <StackVertical padding="md" align="start">
      <SokobanPreview {...args} />
    </StackVertical>
  ),
} satisfies Meta<typeof SokobanPreview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The board as built, the worker and crates where they start. */
export const Default: Story = {};
