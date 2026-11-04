import { Show } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  PersonalPuzzleStatsScreenView,
  type PersonalPuzzleStatsScreenViewProps,
} from './personal-puzzle-stats-screen-view';
import { PuzzleReviewScreenView } from './puzzle-review-screen-view';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';

const STATS = {
  currentRating: 1648,
  ratingDeviation: 58,
  provisional: false,
  totalPlayed: 3,
  totalSolved: 2,
  accuracy: 67,
  currentStreak: 2,
  bestStreak: 2,
  ratingSeries: [1620, 1611, 1632, 1648],
};

const LOG = [
  {
    puzzleId: 'chess/00a3f',
    puzzleRating: 1702,
    outcome: 'solved',
    ratingBefore: 1632,
    ratingAfter: 1648,
    delta: 16,
    rated: true,
    at: '2023-11-14T21:40:00.000Z',
  },
  {
    puzzleId: 'chess:00a3e',
    puzzleRating: 1590,
    outcome: 'solved',
    ratingBefore: 1611,
    ratingAfter: 1632,
    delta: 21,
    rated: true,
    at: '2023-11-14T21:10:00.000Z',
  },
  {
    puzzleId: 'chess:00a3d',
    puzzleRating: 1655,
    outcome: 'failed',
    ratingBefore: 1620,
    ratingAfter: 1611,
    delta: -9,
    rated: true,
    at: '2023-11-14T20:50:00.000Z',
  },
] as const;

/** The routed shell around the stats body, or the review body while reviewing. */
function render(args: PersonalPuzzleStatsScreenViewProps) {
  return (
    <PersonalPuzzleStatsScreenView {...args}>
      <Show
        when={args.reviewing}
        fallback={
          <PuzzleStatsScreenView
            status="ready"
            stats={STATS}
            gameLog={LOG}
            titled={false}
            nested
            onSelectEntry={fn()}
          />
        }
      >
        <PuzzleReviewScreenView
          status="unavailable"
          outcome="solved"
          puzzleRating={1702}
          nested
        />
      </Show>
    </PersonalPuzzleStatsScreenView>
  );
}

const meta = {
  id: 'screens-puzzles-personal-stats',
  title: 'Screens/Puzzles/Personal stats',
  component: PersonalPuzzleStatsScreenView,
  tags: ['autodocs'],
  render,
  parameters: { appRouter: true, controls: { exclude: ['children'] } },
  args: {
    screenId: 'settings-chess-puzzle-stats',
    reviewing: false,
    onBackToStats: fn(),
    children: null,
  },
} satisfies Meta<typeof PersonalPuzzleStatsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** From Settings: the stats under the routed page edge, titled by the crumbs. */
export const Stats: Story = {};

/** A logged puzzle under review; the "Puzzle stats" crumb leads back. */
export const Reviewing: Story = { args: { reviewing: true } };

/** Back (or the stats crumb) closes the review instead of leaving the route. */
export const BackToStats: Story = {
  args: { reviewing: true },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Phone width folds the crumbs into Back; wide layouts show the crumb.
    const back =
      canvas.queryByRole('button', { name: 'Back' }) ??
      (await canvas.findByText('Puzzle stats'));
    await userEvent.click(back);
    await expect(args.onBackToStats).toHaveBeenCalled();
  },
};
