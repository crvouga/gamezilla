import { GameSetupModeContext } from '@libs/spaces-client-ts/game-setup-mode';
import { ClockIcon } from '@pkgs/ui-root-client-ts/icons';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MatchmakingScreenView } from './matchmaking-screen-view';
import {
  renderStory,
  SPEED_RATINGS,
  STORY_FINISHED_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './matchmaking-screen-view.example';
import { MatchmakingStartExample } from './matchmaking-start.example';

const meta = {
  id: 'screens-matchmaking-home',
  title: 'Screens/Space/Matchmaking/Home',
  component: MatchmakingScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory()(args),
  args: {
    ...storyArgs(),
    stage: 'idle',
    place: { screen: 'home' },
  },
} satisfies Meta<typeof MatchmakingScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

const TIMED = {
  title: 'Connect Four',
  goal: 'Drop discs in turn. Four of yours in a row wins.',
  find: { players: 2, timed: true, timeControl: '5+0' },
  ratings: SPEED_RATINGS,
} as const;

/** Before a search: find an opponent for a game without clock choices. */
export const FindOpponent: Story = {};

/** A first visit: nothing was ever sought here, so there is no game to return to. */
export const FirstVisit: Story = {
  args: { find: { players: 2, timed: false, timeControl: '5+0', fresh: true } },
};

/** A game with clock choices: the chosen clock is one row, one press from changing. */
export const FindTimed: Story = { args: TIMED };

/** A bigger game: find the other players, at the same clock choice. */
export const FindPlayers: Story = {
  args: {
    title: 'Hearts',
    goal: 'Take as few hearts as you can. The lowest score wins.',
    find: { players: 4, timed: true, timeControl: '10+5' },
    ratings: SPEED_RATINGS,
  },
};

/**
 * A custom game is under way: seeking is not offered, and returning to the
 * custom game is, in its place.
 */
export const ReturnToCustomGame: Story = {
  args: { returnTo: 'custom', onReturn: fn() },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.queryByTestId('multiplayer-find')).toBeNull();
    await userEvent.click(await canvas.findByTestId('return-to-game-go'));
    await expect(args.onReturn).toHaveBeenCalled();
  },
};

/** An unfinished matched game: the way back to it in place of seeking. */
export const ReturnToMatchedGame: Story = {
  args: { ...TIMED, returnTo: 'matched', onReturn: fn() },
};

/** A command was refused: the reason sits above with the search still on offer. */
export const CommandRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/**
 * A guest near today's allowance: how many free matched games are left, and
 * the way to unlimited, over the search that is still on offer.
 */
export const GuestFewGamesLeft: Story = {
  args: {
    ...TIMED,
    gamesLeft: { left: 2, action: { label: 'Sign in', onPress: fn() } },
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByTestId('multiplayer-games-left')
    ).toHaveTextContent('2 free games left today');
    await expect(canvas.getByTestId('multiplayer-find')).toBeVisible();
    await userEvent.click(
      await canvas.findByRole('button', { name: 'Sign in' })
    );
    await expect(args.gamesLeft?.action?.onPress).toHaveBeenCalled();
  },
};

/** A guest who used today's allowance is invited to sign in to keep playing. */
export const GuestAllowanceUsed: Story = {
  args: {
    ...TIMED,
    commandDenial: {
      icon: ClockIcon,
      title: "You've used today's free games",
      body: 'Sign in to keep playing: accounts play unlimited matched games and keep their rating. Or come back after midnight UTC for new free games.',
      action: { label: 'Sign in', onPress: fn() },
      dataSet: {
        testid: 'multiplayer-command-denial',
        reason: 'quota_exhausted',
      },
    },
  },
};

/** J13: the dock's Sign in is the way back to ranked play. */
export const GuestAllowanceSignIn: Story = {
  args: GuestAllowanceUsed.args ?? {},
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-find-forward')
    );
    await expect(args.commandDenial?.action?.onPress).toHaveBeenCalledTimes(1);
  },
};

/** After a game: the search's hub is one row from the result, for another clock. */
export const AfterTheGame: Story = {
  args: { ...TIMED, stage: 'finished', game: STORY_FINISHED_GAME },
};

/** Offline: a search waits for the connection. */
export const Offline: Story = { args: { online: false } };

/** Long names and many players wrap inside their rows. */
export const LongContent: Story = {
  args: {
    title: 'Connect Four: the extended tournament edition',
    find: { players: 4, timed: true, timeControl: '15+10' },
    ratings: SPEED_RATINGS,
  },
};

/** Choosing a time control returns to the search with it, then finding an opponent at it. */
export const ChooseTimeControl: Story = {
  args: TIMED,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-open-time-control')
    );
    await userEvent.click(
      await canvas.findByTestId('multiplayer-time-control-3-2')
    );
    await expect(args.onChooseTimeControl).toHaveBeenCalledWith('3+2');
    await userEvent.click(await canvas.findByTestId('multiplayer-find'));
    await expect(args.onFind).toHaveBeenCalledWith('3+2');
  },
};

/** The ratings and the guide are each one row away, and Back returns. */
export const OpenRatings: Story = {
  args: TIMED,
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-open-ratings')
    );
    await expect(args.onOpen).toHaveBeenCalledWith({
      screen: 'ratings',
      from: 'home',
    });
    await expect(
      await canvas.findByTestId('multiplayer-rating-blitz-value')
    ).toHaveTextContent('1623');
  },
};

export const KingOfTheHill: Story = {
  parameters: {
    storyRoute: {
      pathname: '/space/story-room',
      tab: false,
      spaceBody: 'shell',
      spaceTitle: 'Quoridor: King of the Hill',
    },
  },
  args: {
    title: 'Quoridor: King of the Hill',
    goal: 'Reach the central hill first. Walls slow the others down.',
    find: { players: 4, timed: true, timeControl: '5+0' },
  },
  render: (args) => (
    <GameSetupModeContext
      value={{
        segments: [
          { key: 'classic', label: 'Classic' },
          { key: 'hill', label: 'King of the Hill' },
        ],
        selected: 'hill',
        onSelect: fn(),
      }}
    >
      {renderStory()(args)}
    </GameSetupModeContext>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole('radio', { name: 'King of the Hill' })
    ).toBeChecked();
  },
};

export const FindAndPlay: Story = {
  render: (args) => <MatchmakingStartExample {...args} />,
};
