import { defineGame } from '@libs/game-session-shared-ts/game-definition';
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

function notices(hill: boolean) {
  return {
    side: (side: GameSide) => quoridorSideLabel(side, hill),
    timeoutDraw: (side: GameSide) =>
      `${quoridorSideLabel(side, hill)} ran out of time. The game is a draw.`,
    ending: (reason: string) =>
      reason === 'hill reached'
        ? 'The central hill was reached.'
        : reason === 'opposite row reached'
          ? 'The opposite home row was reached.'
          : undefined,
  } satisfies GameNoticeText;
}

function definition(rules: typeof quoridorRules, hill: boolean) {
  return defineGame({
    rules,
    capabilities: {
      'custom-games': { bots: quoridorBots },
      matchmaking: {
        clockChoices: true as const,
        namespace: `${rules.id}/`,
        notice: notices(hill),
      },
      history: { record: quoridorRecord },
    },
    turnAutomation: {
      choose: (position, random) =>
        quoridorBots.choose(position, 'medium', random),
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
