import { expect, test } from 'bun:test';
import { SyntheticUserApplication } from '@libs/synthetic-population-shared-ts/synthetic-user-application';
import type { GameAutomation } from '@pkgs/turn-game-shared-ts/game-automation';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { automationDriver } from './automation-driver';

const CONTINUOUS: GameAutomation<Driver> = {
  rules: {
    id: 'counting',
    initial: () => 'count:0',
    recognizes: (s) => s.startsWith('count:'),
  },
  continuous: {
    intervalMs: 100,
    choose: (position) => Number(position.slice(6)),
    parseInput: (value) =>
      typeof value === 'number' && value >= 0 ? value : null,
    perform: (ui, board, side, input) =>
      ui.get(`${board}-${side}-control`).input(String(input)),
  },
};

test('continuous control samples the displayed position, respects cadence and never waits for a move acknowledgement', async () => {
  // regression: synthetic-continuous-input-is-treated-as-a-turn
  let now = 0;
  const attributes = new Map([
    ['multiplayer-game:data-game-id', 'friday-game'],
    ['multiplayer-game:data-fen', 'count:0'],
    ['multiplayer-game:data-shown-position', 'count:3'],
    ['multiplayer-game:data-outcome', 'ongoing'],
    ['multiplayer-game:data-can-move', 'true'],
    ['multiplayer-seat-near:data-side', 'black'],
  ]);
  const surface = automationDriver({
    visible: new Set([
      'multiplayer-game',
      'multiplayer-board',
      'multiplayer-colour',
    ]),
    attributes,
  });
  const events: string[] = [];
  const application = new SyntheticUserApplication(surface.driver, {
    games: [CONTINUOUS],
    clock: { now: () => now },
    random: () => 0,
    username: 'cedar',
    emit: (event) => events.push(event.name),
  });
  application.authenticated();
  const context = { paused: true, draining: true, elapsedMs: 0, sessionMs: 1 };
  try {
    await application.tick(context);
    expect(surface.actions).toEqual(['multiplayer-board-black-control:3']);
    attributes.set('multiplayer-game:data-shown-position', 'count:4');
    now = 99;
    await application.tick(context);
    expect(surface.actions).toHaveLength(1);
    now = 100;
    await application.tick(context);
    expect(surface.actions).toEqual([
      'multiplayer-board-black-control:3',
      'multiplayer-board-black-control:4',
    ]);
    now = 6000;
    attributes.set('multiplayer-game:data-shown-position', 'count:5');
    await application.tick(context);
    expect(surface.actions.at(-1)).toBe('multiplayer-board-black-control:5');
    expect(events).not.toContain('MoveSubmitted');
    attributes.set('multiplayer-game:data-can-move', 'false');
    now += 100;
    await application.tick(context);
    expect(surface.actions).toHaveLength(3);
    attributes.set('multiplayer-game:data-outcome', 'black');
    await application.tick({
      ...context,
      paused: false,
      draining: false,
      sessionMs: 60_000,
    });
    expect(surface.actions).toHaveLength(3);
    expect(events.filter((event) => event === 'GameCompleted')).toHaveLength(1);
  } finally {
    application.close();
  }
});
