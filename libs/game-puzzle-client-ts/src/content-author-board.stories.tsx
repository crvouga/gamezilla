import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PACK,
  AUTHOR_STORY_PARAMETERS,
  renderAuthorStory,
} from './content-author-story.example';
import {
  StoryCountingEditor,
  StoryDraftHistory,
  StoryPackEditor,
} from './content-story.example';

const meta = {
  id: 'screens-puzzles-content-author-board',
  title: 'Screens/Puzzles/Content author/Board',
  component: ContentAuthorScreenView,
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: { ...AUTHOR_STORY_ARGS, place: { screen: 'board' } },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A puzzle draft: the game's own editor under undo and redo. */
export const Puzzle: Story = {};

/**
 * A pack: its puzzles in order, each with its tools, published puzzles to
 * add and a new one to create, instead of a game editor.
 */
export const Pack: Story = {
  args: AUTHOR_STORY_PACK,
  render: (args) =>
    renderAuthorStory(args, { slots: () => ({ stage: <StoryPackEditor /> }) }),
};

/** The draft is saving: the editor and its history wait for it. */
export const Saving: Story = {
  args: { save: { saving: true, dirty: true, error: null }, disabled: true },
  render: (args) =>
    renderAuthorStory(args, {
      slots: () => ({
        history: <StoryDraftHistory disabled />,
        stage: <StoryCountingEditor target="7" disabled />,
      }),
    }),
};

/** Another device kept a different copy: said over the board too. */
export const Conflicted: Story = { args: { conflicted: true } };
