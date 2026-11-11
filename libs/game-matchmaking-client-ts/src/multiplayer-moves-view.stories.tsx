import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_FINISHED_GAME,
  STORY_GAME,
  STORY_PARAMETERS,
  storyArgs,
  storyMoves,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-moves',
  title: 'Screens/Games/Matchmaking/Moves',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) =>
    renderStory({ shown: 2, announcement: { title: 'Your turn.' } })(args),
  args: {
    ...storyArgs(),
    stage: 'playing',
    place: { screen: 'moves' },
    game: { ...STORY_GAME, moves: storyMoves(2) },
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

const WON = {
  title: 'You won the multiplayer game.',
  detail: 'By resignation.',
};

/** An earlier position: which it is, the way back to the game, and the steps. */
export const Reviewing: Story = {};

/** The start of the game: nothing earlier to step back to. */
export const AtTheStart: Story = {
  render: (args) =>
    renderStory({ shown: 0, announcement: { title: 'Your turn.' } })(args),
  args: { game: { ...STORY_GAME, moves: storyMoves(0) } },
};

/** The current position: the board is the game as it stands. */
export const AtTheCurrentPosition: Story = {
  render: (args) =>
    renderStory({ announcement: { title: 'Your turn.' } })(args),
  args: { game: STORY_GAME },
};

/** After the game: its record and final position can be copied. */
export const GameRecord: Story = {
  render: (args) => renderStory({ announcement: WON })(args),
  args: { stage: 'finished', game: STORY_FINISHED_GAME },
};

/** A game without turns keeps only its record. */
export const RecordWithoutTurns: Story = {
  render: (args) => renderStory({ announcement: WON })(args),
  args: {
    title: 'Pong',
    stage: 'finished',
    game: { ...STORY_FINISHED_GAME, flip: null, moves: null },
  },
};

/** Offline: stepping through the moves needs no connection. */
export const Offline: Story = { args: { online: false } };

/** Returning to the current position is one press from the notice. */
export const ReturnToCurrent: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-return-to-current')
    );
    await expect(args.commands.returnToCurrent).toHaveBeenCalled();
  },
};
