import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import type { ShipId } from './battleship-board';
import type { Orientation } from './battleship-fleet';

type Driver = Parameters<NonNullable<TurnGame['turnAutomation']['arrange']>>[0];

/** Choose through the visible ship control in either production layout. */
export async function chooseSetupShip(
  ui: Driver,
  board: string,
  ship: ShipId,
  keyboard = false
): Promise<void> {
  const picker = ui.get(`${board}-ship-picker`);
  if (await picker.isVisible()) {
    if (keyboard) await picker.key('enter');
    else await picker.tap();
  }
  const choice = ui.get(`${board}-ship-${ship}`);
  if (keyboard) await choice.key('space');
  else await choice.tap();
}

/** Navigate the enlarged region before pressing its bow; never use its inert overview. */
export async function placeSetupBow(
  ui: Driver,
  board: string,
  cell: string,
  keyboard = false
): Promise<void> {
  const region = ui.get(`${board}-region`);
  const precise = await region.isVisible();
  if (precise) {
    const area =
      Number(cell.charAt(0) >= 'f') + Number(Number(cell.slice(1)) > 5) * 2;
    const choice = ui.get(`${board}-area-${area}`);
    if (keyboard) await choice.key('enter');
    else await choice.tap();
  }
  const bow = ui.get(`${board}-${precise ? 'precision-cell' : 'cell'}-${cell}`);
  if (keyboard) await bow.key('enter');
  else await bow.tap();
}

export async function setupBoardIsEditable(
  ui: Driver,
  board: string
): Promise<boolean> {
  return (
    (await ui.get(board).isVisible()) &&
    !(await ui.get(`${board}-locked`).isVisible())
  );
}

/** Place the bow and undo any change to the existing fleet if the new bow is refused. */
export async function placeShipOnSetupBoard(
  ui: Driver,
  board: string,
  placement: {
    readonly ship: ShipId;
    readonly cell: string;
    readonly orientation: Orientation;
  },
  keyboard = false
): Promise<void> {
  if (!(await setupBoardIsEditable(ui, board))) return;
  await chooseSetupShip(ui, board, placement.ship, keyboard);
  const rotate = ui.get(`${board}-rotate`);
  const refusal = ui.get(`${board}-refusal`);
  const turn = () => (keyboard ? rotate.key('enter') : rotate.tap());
  let rotatedPlacedShip = false;
  if (
    (await rotate.attribute('data-orientation')) !== placement.orientation &&
    (await rotate.attribute('disabled')) === null
  ) {
    const placed = await ui.get(`${board}-remove`).isVisible();
    await turn();
    rotatedPlacedShip = placed && !(await refusal.isVisible());
  }
  await placeSetupBow(ui, board, placement.cell, keyboard);
  if (rotatedPlacedShip && (await refusal.isVisible())) await turn();
}
