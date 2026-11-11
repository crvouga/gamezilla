import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentLibraryScreenView } from './content-library-screen-view';
import {
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
} from './content-library-story.example';

const meta = {
  id: 'screens-puzzles-content-library-solved',
  title: 'Screens/Puzzles/Content library/Solved',
  component: ContentLibraryScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'solved' } },
} satisfies Meta<typeof ContentLibraryScreenView>;
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
