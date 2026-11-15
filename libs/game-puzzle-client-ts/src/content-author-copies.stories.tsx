import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ContentAuthorScreenView } from './content-author-screen-view';
import {
  AUTHOR_STORY_ARGS,
  AUTHOR_STORY_PACK,
  AUTHOR_STORY_PARAMETERS,
  renderAuthorStory,
  StoryCopies,
} from './content-author-story.example';

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
          <StoryCopies
            copies={[
              {
                id: 'pack-current',
                title: 'Weekend counts',
                difficulty: '',
                description: 'Three puzzles that get harder.',
                conflicted: false,
                validation: 'unchecked',
              },
              {
                id: 'pack-earlier',
                title: 'Weekend puzzles',
                difficulty: '',
                description: 'Two puzzles to start.',
                conflicted: false,
                validation: 'valid',
              },
            ]}
          />
        ),
      }),
    }),
};

/** Using another copy asks first, saying the other copies stay saved. */
export const ConfirmCopy: Story = {
  args: { conflicted: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('content-use-copy-copy-earlier')
    );
    const page = within(canvasElement.ownerDocument.body);
    await expect(
      await page.findByText('Keep working from “Count to five”?')
    ).toBeVisible();
  },
};
