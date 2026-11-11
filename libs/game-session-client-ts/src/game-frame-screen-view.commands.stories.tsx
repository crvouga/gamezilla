import { expect, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { onBoard } from './game-frame-board.example';
import { FRAME_NO_PLAY } from './game-frame-empty';
import { GameFrameScreenView } from './game-frame-screen-view';
import {
  FRAME_CONTROLS_EXCLUDE,
  frameArgs,
  JORDAN,
  MID_GAME_MOVES,
  MORGAN,
  FRAME_PLAYING as PLAYING,
  playSeat,
  record,
  status,
  WATCHED_LINEUP,
} from './game-frame-story.example';

const meta = {
  id: 'screens-games-custom-commands',
  title: 'Screens/Games/Custom game/Game menu',
  component: GameFrameScreenView,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: FRAME_CONTROLS_EXCLUDE },
  },
  args: { ...frameArgs(), ...PLAYING, place: { screen: 'commands' } },
  render: (args) => onBoard(MID_GAME_MOVES)(args),
} satisfies Meta<typeof GameFrameScreenView>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A player's commands: offer a draw, look back, and apart from them, resign. */
export const Player: Story = {};

/** The host of a game against a bot: no draw to offer, and cancelling beside resigning. */
export const HostAgainstBot: Story = {
  args: { play: { ...FRAME_NO_PLAY, canResign: true, canCancel: true } },
};

/** The viewer declined a draw: offering waits until after their next move, and the row says so. */
export const DrawDeclined: Story = {
  args: { play: { ...FRAME_NO_PLAY, offerAgainLater: true, canResign: true } },
};

/** Before the first move there is nothing to review yet. */
export const NoMovesYet: Story = { args: { record: record([]) } };

/** A watcher has only looking back. */
export const Watcher: Story = {
  args: {
    viewerSide: null,
    status: status({ lineup: WATCHED_LINEUP, emphasis: 'neutral' }),
    table: {
      shape: 'strip',
      near: playSeat(MORGAN, { deciding: true }),
      others: [playSeat(JORDAN)],
    },
    play: FRAME_NO_PLAY,
  },
};

/** A refused command stays on the menu, with the reason and every row to try again. */
export const CommandRefused: Story = {
  args: { error: 'A draw has already been offered.' },
};

/** Offering a draw sends it and returns to the board. */
export const OfferDraw: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByTestId('custom-game-offer'));
    await expect(args.onChoose).toHaveBeenCalledWith({ operation: 'offer' });
    await expect(
      await canvas.findByTestId('custom-game-commands')
    ).toBeVisible();
  },
};

/** Resigning asks first: the question, with nothing chosen yet. */
export const ConfirmResign: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByTestId('custom-game-resign'));
    await canvas.findByText(/^This finishes the current game\./);
    await expect(args.onChoose).not.toHaveBeenCalled();
  },
};

/** Confirming finishes the game with its record kept. */
export const ResignConfirmed: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByTestId('custom-game-resign'));
    await userEvent.click(
      await canvas.findByTestId('custom-game-resign-confirm')
    );
    await expect(args.onChoose).toHaveBeenCalledWith({ operation: 'resign' });
  },
};
