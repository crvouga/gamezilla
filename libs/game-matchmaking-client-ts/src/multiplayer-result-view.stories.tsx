import { Badge, type BadgeIntent } from '@pkgs/ui-root-client-ts/badge';
import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MatchmakingScreenView } from './matchmaking-screen-view';
import {
  renderStory,
  STORY_FINISHED_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './matchmaking-screen-view.example';

/** The reason, and the rating change on its own row, as the card lays them out. */
function caption(reason: string, intent: BadgeIntent, change: string) {
  return {
    caption: reason,
    rating: (
      <Badge
        intent={intent}
        tone="subtle"
        label={change === '0' ? 'Rating unchanged' : `Rating ${change}`}
      />
    ),
  };
}

const WON = {
  tone: 'won',
  title: 'You won',
  ...caption('By resignation.', 'success', '+8'),
} as const;

const meta = {
  id: 'screens-matchmaking-result',
  title: 'Screens/Space/Matchmaking/Result',
  component: MatchmakingScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory({ result: WON })(args),
  args: {
    ...storyArgs(),
    stage: 'finished',
    place: { screen: 'result' },
    game: STORY_FINISHED_GAME,
  },
} satisfies Meta<typeof MatchmakingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The game is over: the result card over the final board, a rematch or a new opponent under it. */
export const AfterTheGame: Story = {};

/** A rematch offered to the person is the one filled command. */
export const RematchOffered: Story = {
  render: (args) =>
    renderStory({
      result: {
        tone: 'lost',
        title: 'You lost',
        ...caption(
          'By resignation. Bob offered you a rematch.',
          'destructive',
          '-8'
        ),
      },
    })(args),
  args: { game: { ...STORY_FINISHED_GAME, rematch: 'answer' } },
};

/** A drawn game says so, in its own tone. */
export const Drawn: Story = {
  render: (args) =>
    renderStory({
      result: {
        tone: 'drawn',
        title: 'The game was drawn',
        ...caption('Drawn by agreement.', 'neutral', '0'),
      },
    })(args),
};

/**
 * An aborted game has no result to rematch and no record to keep: aborted
 * on a missed first move, its board is empty and it has nothing to review.
 */
export const Aborted: Story = {
  render: (args) =>
    renderStory({
      shown: 0,
      result: {
        tone: 'neutral',
        aborted: true,
        title: 'The game was aborted',
        caption: "The first move wasn't made in time.",
      },
    })(args),
  args: {
    game: {
      ...STORY_FINISHED_GAME,
      rematch: 'none',
      record: null,
      moves: { moves: [], shownPly: 0, reviewing: null, heading: 'Column' },
    },
  },
};

/** A watcher reads the result and may step through the moves. */
export const Watching: Story = {
  render: (args) =>
    renderStory({
      watching: true,
      result: {
        tone: 'neutral',
        // As the screen says it: who won first, the watching for a listener.
        title: 'alice won',
        caption: 'By resignation.',
      },
    })(args),
  args: {
    game: { ...STORY_FINISHED_GAME, rematch: 'none', newOpponent: false },
  },
};

/** A bigger game finds new players. */
export const ManyPlayers: Story = {
  args: { title: 'Hearts', game: { ...STORY_FINISHED_GAME, players: 4 } },
};

/** Offline: a rematch waits for the connection. */
export const Offline: Story = { args: { online: false } };

/** A new search was refused: finish the other game first. */
export const CommandRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/** The moves are one row away, and Back returns to the result. */
export const OpenMoves: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-open-moves'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'moves' });
    await expect(
      await canvas.findByTestId('multiplayer-copy-game-record')
    ).toBeVisible();
  },
};

/** A new game at another clock starts from the search's hub, one row away. */
export const OpenFind: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-open-find'));
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'home' });
    await expect(await canvas.findByTestId('multiplayer-find')).toBeVisible();
  },
};

/** Seeking a new opponent is the result's one filled command. */
export const NewOpponent: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-new-opponent')
    );
    await expect(args.commands.newOpponent).toHaveBeenCalled();
  },
};
