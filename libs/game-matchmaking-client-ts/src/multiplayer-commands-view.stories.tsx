import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { MultiplayerScreenView } from './multiplayer-screen-view';
import {
  renderStory,
  STORY_GAME,
  STORY_PARAMETERS,
  storyArgs,
} from './multiplayer-screen-view.example';

const meta = {
  id: 'screens-games-matchmaking-commands',
  title: 'Screens/Games/Matchmaking/Game menu',
  component: MultiplayerScreenView,
  tags: ['autodocs'],
  parameters: STORY_PARAMETERS,
  render: (args) => renderStory()(args),
  args: {
    ...storyArgs(),
    stage: 'playing',
    place: { screen: 'commands' },
    game: STORY_GAME,
  },
} satisfies Meta<typeof MultiplayerScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The game's commands, one row each, the one that ends the game apart. */
export const Commands: Story = {};

/** Before both have moved, leaving the game is aborting it. */
export const BeforeTheFirstMoves: Story = {
  args: { game: { ...STORY_GAME, leave: 'abort' } },
};

/** A watcher can turn their own board and step through the moves, nothing more. */
export const Watching: Story = {
  args: { game: { ...STORY_GAME, leave: null, draw: 'none' } },
};

/** While private setups are chosen the moves cannot be stepped through yet. */
export const DuringSetup: Story = {
  args: { stage: 'setup', game: { ...STORY_GAME, leave: 'abort', flip: null } },
};

/** Offline: commands wait for the connection. */
export const Offline: Story = { args: { online: false } };

/** The draw offer was refused: the person stays here and the reason sits above. */
export const CommandRefused: Story = {
  args: { error: 'Multiplayer game could not accept that command.' },
};

/** Resigning asks first; the opponent wins. */
export const ConfirmResign: Story = { args: { confirming: 'resign' } };

/** Resigning a bigger game draws the round for everyone. */
export const ConfirmResignManyPlayers: Story = {
  args: { confirming: 'resign', manyPlayers: true },
};

/** Aborting before the first moves ends the game with no result. */
export const ConfirmAbort: Story = {
  args: { game: { ...STORY_GAME, leave: 'abort' }, confirming: 'abort' },
};

/** Offering a draw sends it and returns to the game. */
export const OfferDraw: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-offer-draw'));
    await expect(args.commands.offerDraw).toHaveBeenCalled();
    await expect(args.onBack).toHaveBeenCalled();
  },
};

/** Resigning only asks: nothing is sent until the person confirms. */
export const AskToResign: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('multiplayer-resign'));
    await expect(args.commands.ask).toHaveBeenCalledWith('resign');
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};
