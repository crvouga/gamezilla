import { expect, test } from 'bun:test';
import {
  establishPongLocalStage,
  holdPaddleUnlessFinished,
} from '@libs/pong-harness-ts/pong-local-actions';
import { pongView, readPongCourt } from '@libs/pong-harness-ts/pong-view';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';
import { ElementNotFoundError } from '@pkgs/ui-testing-root-shared-ts/element-not-found-error';

import { openHarness } from './open-pong-harness';

/** A court as a reopened browser shows it: absent until the board draws. */
function reopenedCourt(): Driver {
  let drawn = false;
  const values: Record<string, Record<string, string>> = {
    'game-session-board-status': { 'data-stage': 'playing' },
    'game-session-board-ball': {
      'data-ball-size': '20',
      'data-ball-x': '500',
      'data-ball-y': '300',
    },
    'game-session-board-drawing': { viewBox: '0 0 1000 600' },
    'game-session-board-first-paddle': { x: '20', width: '10' },
    'game-session-board-second-paddle': { x: '970', width: '10' },
  };
  const texts: Record<string, string> = {
    'game-session-board-status': 'Playing',
    'game-session-board-score-left': 'Left 1',
    'game-session-board-score-right': 'Right 0',
    'game-session-board-target': 'First to 3',
  };
  const node = (id: string) =>
    ({
      expect: {
        visible: async () => {
          // The wait is what gives the reopened app time to draw.
          drawn = true;
        },
      },
      text: async () => {
        if (!drawn) throw new ElementNotFoundError(`testId("${id}")`);
        return texts[id] ?? '';
      },
      attribute: async (name: string) => {
        if (!drawn) return null;
        return values[id]?.[name] ?? null;
      },
    }) as unknown as DriverNode;
  return { get: node } as unknown as Driver;
}

test('a reopened app is read once its court is shown', async () => {
  // regression: pong-court-read-before-reopened-board
  const court = await readPongCourt(reopenedCourt(), 'game-session-board');
  expect(court.score).toEqual({ left: 1, right: 0 });
  expect(court.targetScore).toBe(3);
  expect(court.stage).toBe('playing');
});

/** A paddle control the finished board has already taken away. */
function takenAwayControl(): DriverNode {
  return {
    input: () =>
      Promise.reject(
        new Error(
          'node game-session-board-white-control input: Timed out after 5000ms waiting for testId("game-session-board-white-control") wait "visible"'
        )
      ),
  } as unknown as DriverNode;
}

test('holding a paddle the deciding point took away is the victory', async () => {
  // regression: pong-local-finish-control-race
  expect(
    await holdPaddleUnlessFinished(takenAwayControl(), '0', async () => true)
  ).toBe('finished');
});

test('holding a paddle that fails while the game goes on still fails', async () => {
  await expect(
    holdPaddleUnlessFinished(takenAwayControl(), '0', async () => false)
  ).rejects.toThrow('game-session-board-white-control');
});

// regression: pong-short-match-ends-while-joining
test('a local bot match starts with the normal target for the spectator join and reopen trace', async () => {
  await using s = await openHarness({ seed: 0x67932 });
  await s.apply(establishPongLocalStage, { opponent: 'bot', stage: 'playing' });
  expect((await s.read(pongView)).targetScore).toBe(11);
}, 60_000);
