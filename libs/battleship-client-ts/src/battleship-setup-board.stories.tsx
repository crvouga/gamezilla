import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BattleshipSetupBoard } from './battleship-setup-board';

const FULL_FLEET =
  'fleet:carrier@a1h;battleship@a3v;cruiser@c3v;submarine@e3v;destroyer@g3v';

const meta = {
  id: 'screens-games-battleship-setup',
  title: 'Screens/Games/Battleship/Fleet setup',
  component: BattleshipSetupBoard,
  tags: ['autodocs'],
  parameters: {
    appRouter: true,
    controls: { exclude: ['onChange'] },
  },
  args: {
    setup: '',
    side: 'white',
    locked: false,
    onChange: fn(),
    testId: 'custom-game-setup',
  },
} satisfies Meta<typeof BattleshipSetupBoard>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing placed: the Carrier is chosen first, across, and every cell takes its bow. */
export const Empty: Story = {};

/** Two ships placed; the next unplaced ship is chosen and the count says how far along. */
export const Partial: Story = {
  args: { setup: 'fleet:carrier@a1h;battleship@a3v' },
};

/** All five ships placed: the fleet is ready to be locked in. */
export const Complete: Story = { args: { setup: FULL_FLEET } };

/** A ready fleet is locked: it says so, and no ship can be chosen or moved. */
export const Locked: Story = { args: { setup: FULL_FLEET, locked: true } };

/** A Carrier with its bow at J1 would run off the board: refused, with the reason. */
export const RefusedOffBoard: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-cell-j1')
    );
    await expect(
      await canvas.findByTestId('custom-game-setup-refusal')
    ).toHaveTextContent('run off the board');
    await expect(args.onChange).not.toHaveBeenCalled();
  },
};

/** Choosing a cell places the chosen ship with its bow there. */
export const PlaceAShip: Story = {
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-cell-b2')
    );
    await expect(args.onChange).toHaveBeenCalledWith('fleet:carrier@b2h');
  },
};
