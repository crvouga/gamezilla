import { expect, test } from 'bun:test';
import { isMatchParticipant } from '@libs/synthetic-population-shared-ts/application-navigation';
import {
  gameForPosition,
  openMultiplayer,
} from '@libs/synthetic-population-shared-ts/game-automation';
import { SyntheticUserApplication } from '@libs/synthetic-population-shared-ts/synthetic-user-application';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { GameRules } from '@pkgs/turn-game-shared-ts/game-rules';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { automationDriver } from './automation-driver';

const RULES: GameRules = {
  id: 'counting',
  recognizes: (position) => position.startsWith('count:'),
  initial: () => 'count:0',
  legal: (position) => (position === 'count:3' ? [] : ['advance']),
  canWin: () => true,
  play: () => null,
  replay: () => 'count:0',
  moves: () => [],
};
function game(id: string): GameAutomation<Driver> {
  return {
    rules: { ...RULES, id },
    choose: () => 'advance',
    perform: (ui, board, action) => ui.get(`${board}-${action}`).key('enter'),
  };
}
const COUNTING = game('counting');
const STONES = game('stones');
const noRandom = () => {
  throw new Error('Recovery must not choose a new game');
};

test('any offered game can be selected; the existing game resumes without a new choice', async () => {
  const visible = new Set(['game-menu-counting', 'game-menu-stones']);
  const { driver, actions } = automationDriver({
    visible,
    onTap: (id) => {
      if (id.startsWith('game-menu-')) {
        visible.clear();
        visible.add('game-choice-multiplayer');
      }
    },
  });
  await openMultiplayer(driver, [COUNTING, STONES], () => 0.9);
  expect(actions).toEqual(['game-menu-stones', 'game-choice-multiplayer']);
  actions.length = 0;
  await openMultiplayer(driver, [COUNTING, STONES], noRandom);
  expect(actions).toEqual(['game-choice-multiplayer']);
});

test('one offered game needs no random draw and unavailable games are never selected', async () => {
  const visible = new Set(['game-menu-stones']);
  const { driver, actions } = automationDriver({
    visible,
    onTap: () => visible.add('game-choice-multiplayer'),
  });
  await openMultiplayer(driver, [COUNTING, STONES], noRandom);
  expect(actions).toEqual(['game-menu-stones', 'game-choice-multiplayer']);
  visible.clear();
  await openMultiplayer(driver, [COUNTING, STONES], noRandom);
  expect(actions).toHaveLength(2);
  expect(() => gameForPosition([COUNTING, STONES], 'count:0')).toThrow(
    'unique'
  );
  expect(() => gameForPosition([COUNTING], 'unknown')).toThrow('unique');
});

test('participant ownership does not depend on a game side name or language', async () => {
  // regression: synthetic-opponent-game-coupling
  const surface = automationDriver({
    visible: new Set(['multiplayer-colour']),
    texts: new Map([['multiplayer-colour', 'You play Yellow diamond']]),
  });
  expect(await isMatchParticipant(surface.driver)).toBe(true);
  expect(
    await isMatchParticipant(automationDriver({ visible: new Set() }).driver)
  ).toBe(false);
});

test('an unrelated game uses the same pending, completion and disposal lifecycle', async () => {
  const attributes = new Map([
    ['multiplayer-game:data-fen', 'count:0'],
    ['multiplayer-game:data-outcome', 'ongoing'],
    ['multiplayer-game:data-can-move', 'true'],
  ]);
  const surface = automationDriver({
    visible: new Set([
      'multiplayer-colour',
      'multiplayer-game',
      'multiplayer-board',
    ]),
    attributes,
  });
  const events: string[] = [];
  const application = new SyntheticUserApplication(surface.driver, {
    clock: { now: () => 0 },
    random: () => 0.95,
    username: 'player',
    games: [COUNTING],
    emit: (event) => events.push(event.name),
  });
  application.authenticated();
  const context = { paused: true, draining: true, elapsedMs: 0, sessionMs: 1 };
  try {
    await application.tick(context);
    await application.tick(context);
    expect(surface.actions).toEqual(['multiplayer-board-advance:enter']);
    attributes.set('multiplayer-game:data-fen', 'count:2');
    await application.tick(context);
    expect(surface.actions).toEqual([
      'multiplayer-board-advance:enter',
      'multiplayer-board-advance:enter',
    ]);
    attributes.set('multiplayer-game:data-fen', 'count:3');
    attributes.set('multiplayer-game:data-can-move', 'false');
    attributes.set('multiplayer-game:data-outcome', 'draw');
    // Non-paused post-game policy can browse without issuing a gameplay gesture.
    await application.tick({
      ...context,
      paused: false,
      draining: false,
      sessionMs: 100,
    });
  } finally {
    application.close();
  }
  expect(surface.actions).toEqual([
    'multiplayer-board-advance:enter',
    'multiplayer-board-advance:enter',
  ]);
  expect(events.filter((event) => event === 'GameCompleted')).toHaveLength(1);
  expect(application.actor.getSnapshot().status).toBe('stopped');
});

test('invalid suggestions and spectators cannot submit through the shared controller', async () => {
  const visible = new Set(['multiplayer-game', 'multiplayer-board']);
  const surface = automationDriver({
    visible,
    attributes: new Map([
      ['multiplayer-game:data-fen', 'count:0'],
      ['multiplayer-game:data-outcome', 'ongoing'],
      ['multiplayer-game:data-can-move', 'true'],
    ]),
  });
  const events: string[] = [];
  const application = new SyntheticUserApplication(surface.driver, {
    clock: { now: () => 0 },
    random: () => 0.95,
    username: 'watcher',
    games: [{ ...COUNTING, choose: () => 'invented-action' }],
    emit: (event) => events.push(event.name),
  });
  application.authenticated();
  const context = {
    paused: false,
    draining: false,
    elapsedMs: 0,
    sessionMs: 100,
  };
  try {
    await application.tick(context);
    expect(surface.actions).toEqual([]);
    visible.add('multiplayer-colour');
    await expect(application.tick(context)).rejects.toThrow('illegal action');
    expect(surface.actions).toEqual([]);
    expect(events).not.toContain('MoveSubmitted');
  } finally {
    application.close();
  }
});
