import type { TurnGame } from '@libs/game-session-shared-ts/game-definition';
import { connectFourBots, parseConnectFourColumn } from './connect-four-rules';

export const connectFourAutomation: TurnGame['turnAutomation'] = {
  choose: (position, random) =>
    connectFourBots.choose(position, 'medium', random, null),
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
