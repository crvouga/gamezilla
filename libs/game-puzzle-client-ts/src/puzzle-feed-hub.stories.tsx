import { UserIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
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

/**
 * The feed's `feed` place: what the feed serves next, one row per setting
 * with its current value.
 */
const meta = {
  id: 'screens-puzzles-play-feed',
  title: 'Screens/Puzzles/Play/Feed',
  component: PuzzlePlayScreenView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: { ...PUZZLE_PLAY_STORY_ARGS, place: { screen: 'feed' } },
} satisfies Meta<typeof PuzzlePlayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new player's feed: automatic target, unseen puzzles, every theme. */
export const Default: Story = {};

/** A feed narrowed every way: each row shows the value it holds. */
export const Customized: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      draft: {
        ...STORY_FEED_CONFIG,
        mode: 'custom',
        customRating: 1850,
        historyFilter: 'failed',
        themes: ['mate', 'fork', 'pin'],
        autoAdvance: 'after1s',
      },
      draftTarget: 1850,
      matched: 3,
    },
  },
};

/** The saved settings are not read yet: one activity indicator, no rows. */
export const Loading: Story = {
  args: { feed: { ...STORY_FEED, status: 'loading', savedReady: false } },
};

/** A guest: customizing needs an account, and the way to one is offered. */
export const Locked: Story = {
  args: {
    feed: {
      ...STORY_FEED,
      status: 'locked',
      denial: {
        icon: UserIcon,
        title: 'Sign in to customize your feed',
        body: 'Choose the rating, the themes and the puzzles you see.',
        action: { label: 'Sign in', onPress: fn() },
        dataSet: {
          testid: 'chess-puzzle-feed-locked',
          reason: 'requires_account',
        },
      },
    },
  },
};

/** A game with no themes to choose from has no themes row. */
export const NoThemes: Story = {
  args: { feed: { ...STORY_FEED, themes: null } },
};

/** With no puzzle on the board there is nothing to share. */
export const NoPuzzle: Story = {
  args: { stage: 'empty', share: null },
};

/** A setting's row opens its own screen; choosing there returns with the value. */
export const ChooseHistory: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-row-history')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'feed-history' });
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-feed-history-any')
    );
    await expect(args.feed.onChange).toHaveBeenCalledWith({
      historyFilter: 'any',
    });
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-row-history')
    ).toHaveTextContent('Any');
  },
};

/** Done saves the draft and leaves the settings. */
export const Done: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-puzzle-feed-done'));
    await expect(args.feed.onDone).toHaveBeenCalled();
    await expect(canvas.queryByTestId('chess-puzzle-feed-done')).toBeNull();
  },
};
