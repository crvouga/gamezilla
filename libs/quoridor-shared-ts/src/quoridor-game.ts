import { defineTurnGame } from '@libs/game-session-shared-ts/turn-game-definition';
import type {
  GameNoticeText,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import {
  quoridorBots,
  quoridorHillRules,
  quoridorRecord,
  quoridorRules,
} from './quoridor-rules';

export function quoridorSideLabel(side: GameSide, hill = false): string {
  if (side === 'white') return 'South circle';
  if (side === 'black') return hill ? 'West diamond' : 'North diamond';
  return side === 'red' ? 'North triangle' : 'East square';
}

function notices(hill: boolean): GameNoticeText {
  return {
    side: (side) => quoridorSideLabel(side, hill),
    timeoutDraw: (side) =>
      `${quoridorSideLabel(side, hill)} ran out of time. The game is a draw.`,
    ending: (reason) =>
      reason === 'hill reached'
        ? 'The central hill was reached.'
        : reason === 'opposite row reached'
          ? 'The opposite home row was reached.'
          : undefined,
  };
}

function definition(rules: typeof quoridorRules, hill: boolean) {
  return defineTurnGame({
    rules,
    capabilities: {
      'custom-games': { bots: quoridorBots },
      matchmaking: { clockNamespace: `${rules.id}/`, notice: notices(hill) },
      history: { record: quoridorRecord },
    },
    automation: {
      choose: (position, random) =>
        quoridorBots.choose(position, 'medium', random, null),
      async perform(ui, board, action) {
        const mode = ui.get(
          `${board}-mode-${action.length === 3 ? action[2] : 'move'}`
        );
        await mode.wait('enabled');
        await mode.key('enter');
        const target = ui.get(`${board}-action-${action}`);
        await target.wait('enabled');
        await target.key('enter');
      },
    },
  });
}

export const quoridorGameShared = definition(quoridorRules, false);
export const quoridorHillGameShared = definition(quoridorHillRules, true);
