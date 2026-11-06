import { createSignal } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BattleshipSetupBoard } from './battleship-setup-board';
import {
  checkSetupPlacementBounds,
  checkSetupWorkspace,
  repositionEnlargedShip,
} from './battleship-setup-placement.example';

const FULL_FLEET =
  'fleet:carrier@a1h;battleship@a3v;cruiser@c3v;submarine@e3v;destroyer@g3v';

const meta = {
  id: 'screens-games-battleship-setup',
  title: 'Screens/Games/Battleship/Fleet setup',
  component: BattleshipSetupBoard,
  tags: ['autodocs'],
  render: (args) => {
    const [fleet, setFleet] = createSignal(args.setup);
    return (
      <BattleshipSetupBoard
        {...args}
        setup={fleet()}
        onChange={(value) => {
          setFleet(value);
          args.onChange(value);
        }}
      />
    );
  },
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

/** Place every ship, recover an overlap, then rearrange the completed fleet. */
export const ArrangeFullFleet: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const click = async (suffix: string) =>
      userEvent.click(await canvas.findByTestId(`custom-game-setup-${suffix}`));
    const progress = await canvas.findByTestId('custom-game-setup-progress');
    await click('cell-a1');
    await expect(progress).toHaveTextContent('1 of 5 ships placed');
    await click('cell-a1');
    await expect(
      await canvas.findByTestId('custom-game-setup-refusal')
    ).toBeVisible();
    await expect(progress).toHaveTextContent('1 of 5 ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-a1')
    ).toHaveAccessibleName('A1: Carrier');
    await click('rotate');
    await click('cell-a3');
    await expect(
      canvas.queryByTestId('custom-game-setup-refusal')
    ).not.toBeInTheDocument();
    await click('cell-c3');
    await click('cell-e3');
    await click('cell-g3');
    await expect(progress).toHaveTextContent('All five ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-g4')
    ).toHaveAccessibleName('G4: Destroyer');
    await click('ship-destroyer');
    await click('remove');
    await expect(progress).toHaveTextContent('4 of 5 ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-g4')
    ).toHaveAccessibleName('G4: open water');
    await click('cell-i7');
    await expect(progress).toHaveTextContent('All five ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-i8')
    ).toHaveAccessibleName('I8: Destroyer');
  },
};

/** Enlarged cells place the real fleet and preserve it after a refused overlap. */
export const EnlargedPlacement: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-enlarge')
    );
    // regression: battleship-placement-unlabeled-complete-selection
    await expect(canvas.getByText('Ship', { exact: true })).toBeVisible();
    await expect(canvas.getByText('Region', { exact: true })).toBeVisible();
    await checkSetupWorkspace(canvasElement);
    const bow = await canvas.findByTestId(
      'custom-game-setup-precision-cell-a1'
    );
    await checkSetupPlacementBounds(bow);
    await userEvent.click(bow);
    await expect(
      await canvas.findByTestId('custom-game-setup-progress')
    ).toHaveTextContent('1 of 5 ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-e1')
    ).toHaveAccessibleName('E1: Carrier');
    await checkSetupPlacementBounds(bow);
    await userEvent.click(bow);
    await expect(
      await canvas.findByTestId('custom-game-setup-refusal')
    ).toBeVisible();
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-rotate')
    );
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-precision-cell-a3')
    );
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-a6')
    ).toHaveAccessibleName('A6: Battleship');
    await expect(
      await canvas.findByTestId('custom-game-setup-progress')
    ).toHaveTextContent('2 of 5 ships placed');
    for (const id of ['c3', 'e3']) {
      const target = await canvas.findByTestId(
        `custom-game-setup-precision-cell-${id}`
      );
      await checkSetupPlacementBounds(target);
      await userEvent.click(target);
    }
    await userEvent.click(
      await canvas.findByTestId('custom-game-setup-rotate')
    );
    const last = await canvas.findByTestId(
      'custom-game-setup-precision-cell-b2'
    );
    await checkSetupPlacementBounds(last);
    await userEvent.click(last);
    await expect(
      await canvas.findByTestId('custom-game-setup-progress')
    ).toHaveTextContent('All five ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-c2')
    ).toHaveAccessibleName('C2: Destroyer');
    await expect(
      canvas.getByRole('button', { name: 'Ship to place' })
    ).toHaveTextContent('Choose a ship to reposition');
    await checkSetupWorkspace(canvasElement);
    await repositionEnlargedShip(canvasElement);
  },
};
