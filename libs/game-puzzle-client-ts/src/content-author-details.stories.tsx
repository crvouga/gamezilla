import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PARAMETERS,
  renderAuthorStory,
} from './content-author-story.example';
import { COUNTING_BODY } from './content-story.example';

const meta = {
  id: 'screens-puzzles-content-author-details',
  title: 'Screens/Puzzles/Content author/Details',
  component: ContentAuthorScreenView,
  render: (args) => renderAuthorStory(args),
  parameters: AUTHOR_STORY_PARAMETERS,
  args: { ...AUTHOR_STORY_ARGS, place: { screen: 'details' } },
} satisfies Meta<typeof ContentAuthorScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The draft's title, description and difficulty, saved as they are typed. */
export const Editing: Story = {};

/** A new draft: nothing typed yet. */
export const Untitled: Story = {
  args: {
    body: { ...COUNTING_BODY, title: '', description: '', difficulty: '' },
  },
};

/** A pack change is being kept: the fields wait for it. */
export const Busy: Story = {
  args: {
    metadataDisabled: true,
    disabled: true,
    save: { saving: true, dirty: true, error: null },
  },
};

/** The save failed: the typed details stay, with a retry over them. */
export const SaveFailed: Story = {
  args: {
    save: {
      saving: false,
      dirty: true,
      error: 'The draft could not be saved. Try saving again.',
    },
  },
};

/** Typing a title changes the draft. */
export const TypeTitle: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText('Title'), '!');
    await expect(args.onChangeBody).toHaveBeenCalledWith({
      ...COUNTING_BODY,
      title: `${COUNTING_BODY.title}!`,
    });
  },
};

/** Done returns to the steps. */
export const Done: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-details-done'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'builder' });
  },
};
