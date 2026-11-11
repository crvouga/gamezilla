import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PACK,
  AUTHOR_STORY_PARAMETERS,
  renderAuthorStory,
} from './content-author-story.example';
import { StoryKeptCopies } from './content-story.example';

const meta = {
  id: 'screens-puzzles-content-author-copies',
  title: 'Screens/Puzzles/Content author/Draft copies',
  component: ContentAuthorScreenView,
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: { ...AUTHOR_STORY_ARGS, place: { screen: 'copies' } },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The draft's kept copies, the one being edited marked. */
export const Copies: Story = {};

/** Another device kept a different copy: choosing one comes first. */
export const Conflicted: Story = { args: { conflicted: true } };

/** A pack's copies, by the titles they were saved under. */
export const Pack: Story = {
  args: AUTHOR_STORY_PACK,
  render: (args) =>
    renderAuthorStory(args, {
      slots: () => ({
        keptCopies: (
          <StoryKeptCopies current="Weekend counts" earlier="Weekend puzzles" />
        ),
      }),
    }),
};
