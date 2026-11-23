import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
} from './content-library-story.example';
import { PuzzlePacksHomeScreenView } from './puzzle-packs-home-screen-view';

const meta = {
  id: 'screens-puzzle-packs-home-solved',
  title: 'Screens/Space/Puzzle packs/Home solved',
  component: PuzzlePacksHomeScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'solved' } },
} satisfies Meta<typeof PuzzlePacksHomeScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The puzzles the person finished, each with where its pack stands. */
export const Populated: Story = {};

/** Nothing solved on the loaded page, with earlier attempts still to load. */
export const Empty: Story = {
  args: {
    ...LIBRARY_STORY_EMPTY,
    more: { owned: false, attempts: true, published: false },
  },
};
