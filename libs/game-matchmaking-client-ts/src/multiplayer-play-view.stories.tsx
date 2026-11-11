import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_GAME,
  STORY_PARAMETERS,
  storyArgs,
  storyMoves,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-play',
  title: 'Screens/Games/Matchmaking/Play',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) =>
    renderStory({ announcement: { title: 'Your turn.' } })(args),
  args: {
    ...storyArgs(),
    stage: 'playing',
    place: { screen: 'play' },
    game: STORY_GAME,
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Matched: the seats, the board, whose turn it is, and one way to the game's commands. */
export const Matched: Story = {};

/**
 * An opponent was just found: the versus card covers the board for its
 * count, and a press skips to the board.
 */
export const Versus: Story = {
  args: {
    overlay: { kind: 'versus', count: 3 },
    game: { ...STORY_GAME, leave: 'abort', moves: storyMoves(0) },
  },
  render: (args) =>
    renderStory({ shown: 0, announcement: { title: 'Your turn.' } })(args),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-versus'));
    await expect(args.onOverlay).toHaveBeenCalledWith({ type: 'skip' });
    await expect(canvas.queryByTestId('multiplayer-versus')).toBeNull();
  },
};

/** The versus card as it opens, still: the count at three. */
export const VersusCount: Story = {
  args: {
    overlay: { kind: 'versus', count: 3 },
    game: { ...STORY_GAME, leave: 'abort', moves: storyMoves(0) },
  },
  render: (args) =>
    renderStory({ shown: 0, announcement: { title: 'Your turn.' } })(args),
};

/**
 * A long name beside the turn and the side played: the name is cut short on
 * its one line, the seat keeps its height and the board its full width.
 */
export const LongName: Story = {
  render: (args) =>
    renderStory({
      ownName: 'XenaciousPuffin162',
      announcement: { title: 'Your turn.' },
    })(args),
};

/** A draw offered to the person waits for their answer under the board. */
export const DrawOffered: Story = {
  render: (args) =>
    renderStory({
      announcement: {
        title: 'Your turn.',
        detail: 'Bob offered you a multiplayer draw.',
      },
    })(args),
  args: { game: { ...STORY_GAME, draw: 'answer' } },
};

/** Before the first move there are no moves to list. */
export const NoMovesYet: Story = {
  render: (args) =>
    renderStory({ shown: 0, announcement: { title: 'Your turn.' } })(args),
  args: { game: { ...STORY_GAME, leave: 'abort', moves: storyMoves(0) } },
};

/** A game without turns has no move list and no board to flip. */
export const WithoutTurns: Story = {
  args: { title: 'Pong', game: { ...STORY_GAME, flip: null, moves: null } },
};

/** A watcher has nothing to resign or offer; the moves stay one press away. */
export const Watching: Story = {
  render: (args) =>
    renderStory({
      announcement: { title: 'Watching multiplayer Connect Four.' },
    })(args),
  args: { game: { ...STORY_GAME, leave: null, draw: 'none' } },
};

/** Offline: commands wait for the connection; an accepted game stays here. */
export const Offline: Story = { args: { online: false } };

/** A move was refused: the reason sits above the board. */
export const CommandRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/** Choosing a move opens the moves on the position after it. */
export const OpenMove: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-move-2'));
    await expect(args.commands.chooseMove).toHaveBeenCalledWith(2);
    await expect(
      await canvas.findByTestId('multiplayer-review-back')
    ).toBeVisible();
  },
};

/** Offering a draw and resigning are one press from the board. */
export const OfferDrawNow: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-offer-draw-now')
    );
    await expect(args.commands.offerDraw).toHaveBeenCalled();
    await userEvent.click(await canvas.findByTestId('multiplayer-leave-now'));
    await expect(args.commands.ask).toHaveBeenCalledWith('resign');
  },
};

/** The menu beside them opens the rest of the game's commands. */
export const OpenCommands: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('multiplayer-open-commands')
    );
    await expect(await canvas.findByTestId('multiplayer-resign')).toBeVisible();
  },
};
