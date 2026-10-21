import type { TurnGame } from '@libs/game-session-shared/turn-game-definition';
import { isCell } from './battleship-board';
import { battleshipBots } from './battleship-bot';

export const battleshipAutomation: TurnGame['automation'] = {
  choose: (position, random) =>
    battleshipBots.choose(position, 'medium', random),
  async perform(ui, board, action) {
    if (!isCell(action)) throw new Error('Invalid automated Battleship shot');
    const target = ui.get(`${board}-target-${action}`);
    await target.wait('enabled');
    await target.key('enter');
  },
};
