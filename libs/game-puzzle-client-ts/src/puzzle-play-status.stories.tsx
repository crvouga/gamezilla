import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
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
 * The feed's `status` place: why there is no puzzle on the board, and the
 * one thing to do about it.
 */
const meta = {
  id: 'screens-puzzles-play-status',
  title: 'Screens/Puzzles/Play/Status',
  component: PuzzlePlayScreenView,
  tags: ['autodocs'],
  render: (args, context) =>
    renderPuzzlePlayScene(args, context, StoryPuzzleBoard),
  parameters: {
    appRouter: true,
    controls: { exclude: [...PUZZLE_PLAY_STORY_CONTROLS_EXCLUDE] },
  },
  args: {
    ...PUZZLE_PLAY_STORY_ARGS,
    stage: 'loading',
    place: { screen: 'status' },
    statusKind: 'loading',
    solverSide: null,
    coach: { message: '' },
    elapsedMs: null,
    status: 'loading',
    share: null,
  },
} satisfies Meta<typeof PuzzlePlayScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A pick is pending: one activity indicator. */
export const Loading: Story = {};

/** Nothing synced and no connection: the feed waits to come back online. */
export const Offline: Story = {
  args: { stage: 'offline', statusKind: 'offline' },
};

/** The rated limit is reached: the denial says what unlocks more. */
export const RatedLimitDenied: Story = {
  args: {
    stage: 'limited',
    statusKind: 'limited',
    allowanceLabel: '0 rated puzzles remaining today',
    denial: {
      icon: ClockIcon,
      title: "You've hit today's puzzle limit",
      body: 'Resets in 5 hours.',
      action: { label: 'See plans', onPress: fn() },
      dataSet: { testid: 'chess-puzzle-limit', reason: 'quota_exhausted' },
    },
  },
};

/** Every matching puzzle is played: including played puzzles widens the feed. */
export const Empty: Story = {
  args: {
    stage: 'empty',
    statusKind: 'empty',
    feed: {
      ...STORY_FEED,
      saved: { ...STORY_FEED_CONFIG, themes: ['mate'] },
    },
  },
};

/** "Failed" history with nothing failed yet: the feed explains why it is empty. */
export const EmptyNoFailedYet: Story = {
  args: {
    ...Empty.args,
    feed: {
      ...STORY_FEED,
      saved: { ...STORY_FEED_CONFIG, historyFilter: 'failed' },
    },
  },
};

/** Nothing synced near the target and no filter to widen: change the settings. */
export const EmptyAtThisRating: Story = {
  args: {
    ...Empty.args,
    feed: {
      ...STORY_FEED,
      saved: { ...STORY_FEED_CONFIG, historyFilter: 'any' },
    },
  },
};

/** Spectating before the host starts: waiting for the host, nothing to set. */
export const WaitingForHost: Story = {
  args: { stage: 'waiting', statusKind: 'waiting', spectator: true },
};

/** The empty feed's own command widens it. */
export const IncludePlayedPuzzles: Story = {
  args: { ...Empty.args },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('chess-puzzle-empty-pool-action')
    );
    await expect(args.onIncludeAllPuzzles).toHaveBeenCalled();
  },
};

/** The settings row opens the puzzle settings. */
export const OpenSettings: Story = {
  args: { ...Offline.args },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('chess-puzzle-feed-summary'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'feed' });
    await expect(
      await canvas.findByTestId('chess-puzzle-feed-done')
    ).toBeVisible();
  },
};
