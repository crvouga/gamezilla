import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import { isCell, SHIPS } from './battleship-board';
import { battleshipBots } from './battleship-bot';
import { parseFleet } from './battleship-fleet';
import { chooseSetupShip, placeSetupBow } from './battleship-setup-gestures';

export const battleshipAutomation: TurnGame['turnAutomation'] = {
  choose: (position, random) =>
    battleshipBots.choose(position, 'medium', random, null),
  async perform(ui, board, action) {
    if (!isCell(action)) throw new Error('Invalid automated Battleship shot');
    const area =
      Number(action.charAt(0) >= 'f') +
      Math.floor((Number(action.slice(1)) - 1) / 2) * 2;
    await ui.get(`${board}-area-${area}`).key('enter');
    const target = ui.get(`${board}-aim-${action}`);
    await target.wait('enabled');
    await target.key('enter');
    const fire = ui.get(`${board}-fire`);
    await fire.wait('enabled');
    await fire.key('enter');
  },
  /**
   * Take every placed ship off the board, so none stands where another
   * goes; then choose each ship, turn it to its orientation, and press its
   * bow cell.
   */
  async arrange(ui, board, setup) {
    const fleet = parseFleet(setup);
    if (fleet === null) throw new Error('Invalid automated Battleship fleet');
    // regression: battleship-arrange-over-fleet
    for (const { id } of SHIPS) {
      await chooseSetupShip(ui, board, id);
      const remove = ui.get(`${board}-remove`);
      if ((await remove.attribute('disabled')) === null) await remove.tap();
    }
    for (const ship of fleet) {
      await chooseSetupShip(ui, board, ship.ship);
      const rotate = ui.get(`${board}-rotate`);
      if ((await rotate.attribute('data-orientation')) !== ship.orientation)
        await rotate.tap();
      await placeSetupBow(ui, board, ship.bow);
    }
  },
};
