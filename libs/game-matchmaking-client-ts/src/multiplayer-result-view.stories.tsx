import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_FINISHED_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const WON = {
  title: 'You won the multiplayer game.',
  caption: 'By resignation. Your rating changed by +8.',
};

const meta = {
  id: 'screens-games-matchmaking-result',
  title: 'Screens/Games/Matchmaking/Result',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory({ outcome: WON })(args),
  args: {
    ...storyArgs(),
    stage: 'finished',
    place: { screen: 'result' },
    game: STORY_FINISHED_GAME,
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The game is over: the result, a rematch or a new opponent, the final board. */
export const AfterTheGame: Story = {};

/** A rematch offered to the person is the one filled command. */
export const RematchOffered: Story = {
  render: (args) =>
    renderStory({
      outcome: {
        title: 'Your opponent won the multiplayer game.',
        caption:
          'By resignation. Bob offered you a multiplayer rematch. Your rating changed by -8.',
      },
    })(args),
  args: { game: { ...STORY_FINISHED_GAME, rematch: 'answer' } },
};

/** An aborted game has no result to rematch and no record to keep. */
export const Aborted: Story = {
  render: (args) =>
    renderStory({
      outcome: {
        title: 'The multiplayer game was aborted.',
        caption: "The first move wasn't made in time.",
      },
    })(args),
  args: { game: { ...STORY_FINISHED_GAME, rematch: 'none', record: null } },
};

/** A watcher reads the result and may step through the moves. */
export const Watching: Story = {
  render: (args) =>
    renderStory({
      outcome: {
        title:
          'Watching multiplayer Connect Four. alice won the multiplayer game.',
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
    await expect(args.onOpen).toHaveBeenCalledWith({ screen: 'find' });
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
