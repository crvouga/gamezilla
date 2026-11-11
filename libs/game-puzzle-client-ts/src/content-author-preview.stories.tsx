import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PACK,
  AUTHOR_STORY_PARAMETERS,
  renderAuthorStory,
} from './content-author-story.example';
import { StoryPackOverview } from './content-story.example';

const meta = {
  id: 'screens-puzzles-content-author-preview',
  title: 'Screens/Puzzles/Content author/Preview',
  component: ContentAuthorScreenView,
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: {
    ...AUTHOR_STORY_ARGS,
    place: { screen: 'preview', puzzleId: null },
  },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A puzzle draft as a solver sees it: its board, nothing to change. */
export const Puzzle: Story = {};

/** A pack draft: its puzzles, each opening its own preview. */
export const Pack: Story = {
  args: AUTHOR_STORY_PACK,
  render: (args) =>
    renderAuthorStory(args, {
      slots: () => ({ preview: <StoryPackOverview /> }),
    }),
};

/** One of a pack's puzzles, previewed; Back returns to the pack's list. */
export const PackPuzzle: Story = {
  args: {
    ...AUTHOR_STORY_PACK,
    place: { screen: 'preview', puzzleId: 'puzzle-count-to-seven' },
  },
};
