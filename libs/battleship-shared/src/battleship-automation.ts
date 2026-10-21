import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import { isCell } from './battleship-board';
import { battleshipBots } from './battleship-bot';
import { parseFleet } from './battleship-fleet';

export const battleshipAutomation: TurnGame['automation'] = {
  choose: (position, random) =>
    battleshipBots.choose(position, 'medium', random),
  async perform(ui, board, action) {
    if (!isCell(action)) throw new Error('Invalid automated Battleship shot');
    const target = ui.get(`${board}-target-${action}`);
    await target.wait('enabled');
    await target.key('enter');
  },
  /** Choose each ship, turn it to its orientation, and press its bow cell. */
  async arrange(ui, board, setup) {
    const fleet = parseFleet(setup);
    if (fleet === null) throw new Error('Invalid automated Battleship fleet');
    for (const ship of fleet) {
      await ui.get(`${board}-ship-${ship.ship}`).tap();
      const rotate = ui.get(`${board}-rotate`);
      if ((await rotate.attribute('data-orientation')) !== ship.orientation)
        await rotate.tap();
      await ui.get(`${board}-cell-${ship.bow}`).tap();
    }
  },
};
