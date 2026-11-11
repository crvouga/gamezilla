import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentLibraryScreenView } from './content-library-screen-view';
import {
  COUNT_TO_SEVEN,
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
} from './content-library-story.example';

const meta = {
  id: 'screens-puzzles-content-library-browse',
  title: 'Screens/Puzzles/Content library/Browse',
  component: ContentLibraryScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'browse' } },
} satisfies Meta<typeof ContentLibraryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Everything published, as cards, with a further page to load. */
export const Populated: Story = {};

/** Nothing published has loaded: what to do meanwhile. */
export const Empty: Story = { args: LIBRARY_STORY_EMPTY };

/** Long titles and descriptions wrap or truncate without breaking cards. */
export const LongContent: Story = {
  args: {
    published: [
      {
        ...COUNT_TO_SEVEN,
        title:
          'Count all the way to ninety-nine without overshooting even once',
        description:
          'A long description that keeps going to show how the caption behaves when an author writes a paragraph instead of a sentence.',
        difficulty: 'Very difficult',
      },
    ],
  },
};

/** Pressing a published puzzle opens its edition. */
export const OpenPublished: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId(`content-published-${COUNT_TO_SEVEN.id}`)
    );
    await expect(args.onOpenEdition).toHaveBeenCalledWith(COUNT_TO_SEVEN.id);
  },
};

/** Loading the next page asks for it. */
export const LoadMore: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('content-more-published'));
    await expect(args.onMorePublished).toHaveBeenCalled();
  },
};
