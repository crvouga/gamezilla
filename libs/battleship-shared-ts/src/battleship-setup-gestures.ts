import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import type { ShipId } from './battleship-board';

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
  const region = ui.get(`${board}-region-picker`);
  const precise = await region.isVisible();
  if (precise) {
    const area = `${Number(cell.slice(1)) <= 5 ? 'n' : 's'}${cell.charAt(0) < 'f' ? 'w' : 'e'}`;
    if (keyboard) await region.key('enter');
    else await region.tap();
    const choice = ui.get(`${board}-region-${area}`);
    if (keyboard) await choice.key('enter');
    else await choice.tap();
  }
  const bow = ui.get(`${board}-${precise ? 'precision-cell' : 'cell'}-${cell}`);
  if (keyboard) await bow.key('enter');
  else await bow.tap();
}
