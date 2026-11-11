import { expect, test } from 'bun:test';
import { isMatchParticipant } from '@libs/synthetic-population-behavior-shared-ts/application-navigation';
import {
  gameForPosition,
  openMultiplayer,
} from '@libs/synthetic-population-behavior-shared-ts/game-automation';
import { SyntheticUserApplication } from '@libs/synthetic-population-behavior-shared-ts/synthetic-user-application';
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
    turns: {
      rules: { ...RULES, id },
      choose: () => 'advance',
      perform: (ui, board, action) => ui.get(`${board}-${action}`).key('enter'),
    },
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
  let now = 0;
  const application = new SyntheticUserApplication(surface.driver, {
    clock: { now: () => now },
    random: () => 0.95,
    username: 'player',
    games: [COUNTING],
    emit: (event) => events.push(event.name),
  });
  application.authenticated();
  const context = { paused: true, draining: true, elapsedMs: 0, sessionMs: 1 };
  try {
    // Each move waits out its thinking time.
    await application.tick(context);
    now = 20_000;
    await application.tick(context);
    await application.tick(context);
    expect(surface.actions).toEqual(['multiplayer-board-advance:enter']);
    attributes.set('multiplayer-game:data-fen', 'count:2');
    await application.tick(context);
    now = 40_000;
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
  let now = 0;
  const application = new SyntheticUserApplication(surface.driver, {
    clock: { now: () => now },
    random: () => 0.95,
    username: 'watcher',
    games: [
      {
        ...COUNTING,
        turns: { ...COUNTING.turns!, choose: () => 'invented-action' },
      },
    ],
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
    await application.tick(context);
    now = 20_000;
    await expect(application.tick(context)).rejects.toThrow('illegal action');
    expect(surface.actions).toEqual([]);
    expect(events).not.toContain('MoveSubmitted');
  } finally {
    application.close();
  }
});

test('a Synthetic User thinks for a human-like time before each move, never at once', async () => {
  let now = 1_000;
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
  const application = new SyntheticUserApplication(surface.driver, {
    clock: { now: () => now },
    random: () => 0,
    username: 'player',
    games: [COUNTING],
    persona: {
      thinkingTime: { minMs: 6_000, maxMs: 7_999 },
      skillLevel: 'strong',
      rematchWeight: 0,
      hostingWeight: 0,
      favoriteGames: [],
    },
    memory: { previousThinkingMs: 6_100 },
    emit: () => undefined,
  });
  application.authenticated();
  try {
    await application.continueCurrentGame();
    expect(surface.actions).toEqual([]);
    // The previous move took 6 seconds: this one takes 7.
    expect(application.nextWakeAt()).toBe(8_000);
    now = 7_999;
    await application.continueCurrentGame();
    expect(surface.actions).toEqual([]);
    now = 8_000;
    await application.continueCurrentGame();
    expect(surface.actions).toEqual(['multiplayer-board-advance:enter']);
  } finally {
    application.close();
  }
});

test('after a game, a Synthetic User finds its next opponent from the result', async () => {
  // regression: synthetic-user-find-after-game
  const visible = new Set([
    'multiplayer-open-find',
    'multiplayer-new-opponent',
  ]);
  const surface = automationDriver({
    visible,
    onTap: (id) => {
      // The result's row opens the search's hub, where Find is.
      if (id !== 'multiplayer-open-find') return;
      visible.clear();
      visible.add('multiplayer-find');
    },
  });
  const application = new SyntheticUserApplication(surface.driver, {
    clock: { now: () => 0 },
    random: () => 0.5,
    username: 'cedar',
    games: [COUNTING],
    persona: {
      thinkingTime: { minMs: 2_000, maxMs: 8_000 },
      skillLevel: 'intermediate',
      rematchWeight: 0,
      hostingWeight: 0,
      favoriteGames: [],
    },
    emit: () => undefined,
  });
  application.authenticated();
  try {
    await application.tick({
      paused: false,
      draining: false,
      elapsedMs: 0,
      sessionMs: 60_000,
    });
  } finally {
    application.close();
  }
  expect(surface.actions).toEqual([
    'multiplayer-open-find',
    'multiplayer-find',
  ]);
});
