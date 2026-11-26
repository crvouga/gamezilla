import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { fn } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { SokobanHistory } from './sokoban-history.example';
import { SokobanPlayer } from './sokoban-player';

const pack = sokobanPuzzleContent.bundledPacks?.[1];
const puzzle = pack?.puzzles[0];
const next = pack?.puzzles[1];
if (!pack || !puzzle || !next) throw new Error('Missing Sokoban catalog pack');
const start = sokobanPuzzleContent.rules.initial(puzzle.definition);
if (!start.accepted) throw new Error('The first catalog puzzle cannot open');

const openLibrary = fn();

const meta = {
  id: 'screens-games-sokoban-catalog',
  title: 'Screens/Space/Boards/Sokoban/Catalog',
  component: SokobanPlayer,
  tags: ['autodocs'],
  parameters: { appRouter: true },
  args: {
    definition: puzzle.definition,
    state: start.state,
    onAction: fn(),
    disabled: false,
  },
  render: (args) => (
    <SokobanHistory
      {...args}
      puzzle={{
        title: puzzle.title,
        description: puzzle.description,
        difficulty: puzzle.difficulty,
        pack: { title: pack.title, position: 1, total: pack.puzzles.length },
      }}
      nextTitle={next.title}
      onOpenLibrary={openLibrary}
    />
  ),
} satisfies Meta<typeof SokobanPlayer>;

export default meta;
export const FirstWarehouse: StoryObj<typeof meta> = {};
