import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentLibraryScreenView } from './content-library-screen-view';
import {
  LIBRARY_STORY_ARGS,
  LIBRARY_STORY_EMPTY,
  LIBRARY_STORY_PARAMETERS,
} from './content-library-story.example';

const meta = {
  id: 'screens-puzzles-content-library-continue',
  title: 'Screens/Puzzles/Content library/Continue',
  component: ContentLibraryScreenView,
  parameters: LIBRARY_STORY_PARAMETERS,
  args: { ...LIBRARY_STORY_ARGS, place: { screen: 'continue' } },
} satisfies Meta<typeof ContentLibraryScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What the person left unfinished, each row opening at the move they left it. */
export const Populated: Story = {};

/** Nothing started: the list says so and leads to Browse. */
export const Empty: Story = { args: LIBRARY_STORY_EMPTY };

/** Earlier attempts wait on a further page. */
export const MorePages: Story = {
  args: { more: { owned: false, attempts: true, published: false } },
};

/** Pressing an attempt opens it. */
export const OpenAttempt: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('content-attempt-attempt-1')
    );
    await expect(args.onOpenAttempt).toHaveBeenCalledWith('attempt-1');
  },
};

/** The empty list's command opens Browse. */
export const BrowseFromEmpty: Story = {
  args: LIBRARY_STORY_EMPTY,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Browse puzzles' })
    );
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'browse' });
  },
};
