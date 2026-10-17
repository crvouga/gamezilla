import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { connectFourRules, parseConnectFourColumn } from './connect-four-rules';

export const connectFourAutomation: GameAutomation<Driver> = {
  rules: connectFourRules,
  choose: (position, random) =>
    connectFourRules.choose(position, 'medium', random),
  async perform(ui, board, action) {
    const column = parseConnectFourColumn(action);
    if (column === null)
      throw new Error('Invalid automated Connect Four action');
    const target = ui.get(`${board}-column-${column + 1}`);
    // regression: connect-four-journey-pending-column
    await target.wait('enabled');
    await target.key('enter');
  },
};
