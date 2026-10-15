import type { GameAutomation } from '@pkgs/turn-game-shared/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import { connectFourRules, parseConnectFourColumn } from './connect-four-rules';

export const connectFourAutomation: GameAutomation<Driver> = {
  rules: connectFourRules,
  selectControl: 'game-menu-connect-four',
  multiplayerControl: 'connect-four-multiplayer',
  boardControl: 'connect-four-board',
  choose: (position, random) =>
    connectFourRules.choose(position, 'medium', random),
  async perform(ui, action) {
    const column = parseConnectFourColumn(action);
    if (column === null)
      throw new Error('Invalid automated Connect Four action');
    await ui.get(`connect-four-column-${column + 1}`).key('enter');
  },
};
