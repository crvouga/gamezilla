import { createSignal, Show } from 'solid-js';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { BattleshipSetupBoard } from './battleship-setup-board';
import {
  checkSetupPlacementBounds,
  checkSetupRecovery,
  checkSetupWorkspace,
  chooseSetupRegion,
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
      <Show when={args.initialPlacement} keyed>
        <BattleshipSetupBoard
          {...args}
          setup={fleet()}
          onChange={(value) => {
            setFleet(value);
            args.onChange(value);
          }}
        />
      </Show>
    );
  },
  parameters: {
    appRouter: true,
    controls: { exclude: ['onChange'] },
  },
  argTypes: {
    initialPlacement: {
      control: 'select',
      options: ['responsive', 'full', 'enlarged'],
    },
  },
  args: {
    initialPlacement: 'responsive',
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
export const Empty: Story = {
  play: async ({ canvasElement }) => {
    if (window.innerWidth >= 640) return;
    await checkSetupWorkspace(canvasElement);
    await checkSetupPlacementBounds(
      within(canvasElement).getByTestId('custom-game-setup-precision-cell-a1')
    );
  },
};

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
  args: { initialPlacement: 'full' },
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
  args: { initialPlacement: 'full' },
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
  args: { initialPlacement: 'full' },
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
    if (!canvas.queryByTestId('custom-game-setup-precision'))
      await userEvent.click(canvas.getByTestId('custom-game-setup-enlarge'));

    // regression: battleship-placement-unlabeled-complete-selection
    await expect(
      canvas.getByRole('button', { name: /^Ship to place:/ })
    ).toBeVisible();
    await expect(
      canvas.getByText('Choose region', { exact: true })
    ).toBeVisible();
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
    const previousTop = canvas
      .getByTestId('custom-game-setup-precision')
      .getBoundingClientRect().top;
    await userEvent.keyboard('{Enter}');
    await checkSetupRecovery(canvasElement, previousTop);
    await expect(
      await canvas.findByTestId('custom-game-setup-refusal')
    ).toBeVisible();
    await checkSetupPlacementBounds(
      canvas.getByTestId('custom-game-setup-precision-cell-a3')
    );
    await userEvent.keyboard('r{ArrowDown}{ArrowDown}{Enter}');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-a6')
    ).toHaveAccessibleName('A6: Battleship');
    await expect(
      await canvas.findByTestId('custom-game-setup-progress')
    ).toHaveTextContent('2 of 5 ships placed');
    await chooseSetupRegion(canvasElement, 'F–J / 1–5');
    const cruiser = canvas.getByTestId('custom-game-setup-precision-cell-g2');
    await checkSetupPlacementBounds(cruiser);
    await userEvent.click(cruiser);
    await chooseSetupRegion(canvasElement, 'A–E / 6–10');
    await userEvent.click(canvas.getByTestId('custom-game-setup-rotate'));
    const submarine = canvas.getByTestId('custom-game-setup-precision-cell-b8');
    await checkSetupPlacementBounds(submarine);
    await userEvent.click(submarine);
    await chooseSetupRegion(canvasElement, 'A–E / 1–5');
    const last = await canvas.findByTestId(
      'custom-game-setup-precision-cell-b2'
    );
    await checkSetupWorkspace(canvasElement);
    await checkSetupPlacementBounds(last);
    await userEvent.click(last);
    await expect(
      await canvas.findByTestId('custom-game-setup-progress')
    ).toHaveTextContent('All five ships placed');
    await expect(
      await canvas.findByTestId('custom-game-setup-cell-c2')
    ).toHaveAccessibleName('C2: Destroyer');
    await expect(
      canvas.getByRole('button', { name: /^Ship to place:/ })
    ).toHaveTextContent('Choose a ship to reposition');
    await checkSetupWorkspace(canvasElement);
    await repositionEnlargedShip(canvasElement);
  },
};

/** One direct region press replaces opening a dropdown and choosing its option. */
export const SpatialRegionSelection: Story = {
  args: { initialPlacement: 'enlarged', setup: 'fleet:carrier@a1h' },
  play: async ({ canvasElement }) => {
    // regression: battleship-round8-spatial-placement
    const canvas = within(canvasElement);
    await checkSetupWorkspace(canvasElement);
    await chooseSetupRegion(canvasElement, 'F–J / 6–10');
    await checkSetupWorkspace(canvasElement);
    const cell = canvas.getByTestId('custom-game-setup-precision-cell-f6');
    await checkSetupPlacementBounds(cell);
    await userEvent.click(cell);
    await expect(
      canvas.getByTestId('custom-game-setup-cell-i6')
    ).toHaveAccessibleName('I6: Battleship');
  },
};
