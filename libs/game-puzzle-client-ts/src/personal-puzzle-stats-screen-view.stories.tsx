import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import {
  PersonalPuzzleStatsScreenView,
  type PersonalPuzzleStatsScreenViewProps,
} from './personal-puzzle-stats-screen-view';
import { PuzzleReviewScreenView } from './puzzle-review-screen-view';
import { PuzzleStatsScreenView } from './puzzle-stats-screen-view';
import { STORY_LOG, STORY_STATS } from './puzzle-stats-story.example';

/** The routed shell around the stats' small screen the story's place names. */
function render(args: PersonalPuzzleStatsScreenViewProps) {
  return (
    <PersonalPuzzleStatsScreenView {...args}>
      <PuzzleStatsScreenView
        stage="ready"
        place={args.place}
        onOpen={args.onOpen}
        stats={STORY_STATS}
        gameLog={STORY_LOG}
        titled={false}
        nested
        onSelectEntry={fn()}
        review={
          <PuzzleReviewScreenView
            status="unavailable"
            outcome="solved"
            puzzleRating={1702}
            nested
            onBackToLog={() => args.onOpen({ screen: 'log' })}
          />
        }
      />
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
    place: { screen: 'summary' },
    onOpen: fn(),
    children: null,
  },
} satisfies Meta<typeof PersonalPuzzleStatsScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** From Settings: the summary under the routed page edge, titled by the crumbs. */
export const Stats: Story = {};

/** The rating trend; the "Puzzle stats" crumb leads back. */
export const Trend: Story = { args: { place: { screen: 'trend' } } };

/** The game log; the "Puzzle stats" crumb leads back. */
export const Log: Story = { args: { place: { screen: 'log' } } };

/** A logged puzzle under review; the "Game log" crumb leads back to the log. */
export const Reviewing: Story = {
  args: { place: { screen: 'review', puzzleId: 'chess:00005' } },
};

/** Back (or the log crumb) closes the review instead of leaving the route. */
export const BackToStats: Story = {
  args: { place: { screen: 'review', puzzleId: 'chess:00005' } },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    // Phone width folds the crumbs into Back; wide layouts show the crumb.
    const back =
      canvas.queryByRole('button', { name: 'Back' }) ??
      (await canvas.findByText('Game log'));
    await userEvent.click(back);
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'log' });
  },
};
