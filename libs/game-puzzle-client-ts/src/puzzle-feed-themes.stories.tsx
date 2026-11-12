import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { PuzzlePlayScreenView } from './puzzle-play-screen-view';
import {
  PUZZLE_PLAY_STORY_ARGS,
  PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE,
  renderPuzzlePlayScene,
  STORY_FEED,
  STORY_FEED_CONFIG,
  StoryPuzzleBoard,
} from './puzzle-screen-story.example';

/** The feed's `feed-themes` place: the themes the feed is narrowed to. */
const meta = {
  id: 'screens-puzzles-play-feed-themes',
  title: 'Screens/Puzzles/Play/Feed themes',
  component: PuzzlePlayScreenView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_PLAY_STORY_ARGS, place: { screen: 'feed-themes' } },
} satisfies Meta<typeof PuzzlePlayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** No theme chosen: the feed serves every theme. */
export const AnyTheme: Story = {};

/** Three themes chosen: each is marked, and their count is said. */
export const SomeChosen: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      draft: { ...STORY_FEED_CONFIG, themes: ['mate', 'fork', 'pin'] },
    },
  },
};

/** A search with no match says so, and what to try. */
export const NoMatch: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      // The test id marks the field's wrapper; a person types in the box.
      await canvas.findByRole('searchbox', { name: 'Search themes…' }),
      'zugzwang'
    );
    await expect(await canvas.findByText('No matching themes')).toBeVisible();
  },
};

/** A theme found by search is chosen; a theme the search hides stays chosen. */
export const SearchAndChoose: Story = {
  args: { ...SomeChosen.args },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      // The test id marks the field's wrapper; a person types in the box.
      await canvas.findByRole('searchbox', { name: 'Search themes…' }),
      'sacr'
    );
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-theme-sacrifice')
    );
    await expect(args.feed.onChange).toHaveBeenCalledWith({
      themes: ['mate', 'sacrifice', 'fork', 'pin'],
    });
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-theme-done')
    );
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-theme-trigger')
    ).toHaveTextContent('4 themes');
  },
};
