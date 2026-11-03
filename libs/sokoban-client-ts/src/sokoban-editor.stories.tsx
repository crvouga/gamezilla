import { initialSokobanDefinition } from '@libs/sokoban-shared-ts/sokoban-board-edits';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanEditor } from './sokoban-editor';
import { TWO_CRATES } from './sokoban-player.example';

const meta = {
  id: 'screens-games-sokoban-editor',
  title: 'Screens/Games/Sokoban/Editor',
  component: SokobanEditor,
  tags: ['autodocs'],
  parameters: { appRouter: true, controls: { exclude: ['onChange'] } },
  args: {
    definition: initialSokobanDefinition(),
    disabled: false,
    onChange: fn(),
  },
} satisfies Meta<typeof SokobanEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new board: one worker, one crate, one goal inside walls. */
export const NewBoard: Story = {};

/** A larger draft with two crates and two goals. */
export const TwoCrates: Story = { args: { definition: TWO_CRATES } };

/** No worker and more goals than crates: the corrections it needs are listed. */
export const NeedsCorrections: Story = {
  args: {
    definition: JSON.stringify({
      format: 1,
      rows: ['######', '#    #', '# $..#', '#    #', '######'],
    }),
  },
};

/** While the shared builder saves, no tool or square can be used. */
export const Disabled: Story = { args: { disabled: true } };

/** A draft this app cannot read points at an earlier saved draft. */
export const Unreadable: Story = { args: { definition: 'not a board' } };
