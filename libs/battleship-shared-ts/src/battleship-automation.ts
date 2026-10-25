import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import { isCell, SHIPS } from './battleship-board';
import { battleshipBots } from './battleship-bot';
import { parseFleet } from './battleship-fleet';

export const battleshipAutomation: TurnGame['turnAutomation'] = {
  choose: (position, random) =>
    battleshipBots.choose(position, 'medium', random, null),
  async perform(ui, board, action) {
    if (!isCell(action)) throw new Error('Invalid automated Battleship shot');
    const target = ui.get(`${board}-target-${action}`);
    await target.wait('enabled');
    await target.key('enter');
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
      await ui.get(`${board}-ship-${id}`).tap();
      const remove = ui.get(`${board}-remove`);
      if ((await remove.attribute('disabled')) === null) await remove.tap();
    }
    for (const ship of fleet) {
      await ui.get(`${board}-ship-${ship.ship}`).tap();
      const rotate = ui.get(`${board}-rotate`);
      if ((await rotate.attribute('data-orientation')) !== ship.orientation)
        await rotate.tap();
      await ui.get(`${board}-cell-${ship.bow}`).tap();
    }
  },
};
