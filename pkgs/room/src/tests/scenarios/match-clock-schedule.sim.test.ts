import { describe, expect, test } from 'bun:test';

import { openWorld } from '../../sim/world';
import {
  FlagFall,
  MatchClockFixtureModule,
  Move,
  matchClockBlackMs,
  matchClockStatus,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  StartMatch,
} from '../fixtures/match-clock-module';

describe('match-clock schedule (MC-01..06)', () => {
  test('MC-01: runFor past flag → server FlagFall terminal; clients converge', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? 'mc-01',
      module: MatchClockFixtureModule,
      startMs: 10_000,
    });
    const a = await world.addClient({ id: 'white', identity: 'white' });
    const b = await world.addClient({ id: 'black', identity: 'black' });
    await world.assertConverged();

    a.dispatch(StartMatch({ whiteMs: 50, blackMs: 80 }));
    await world.drain();
    expect(matchClockStatus(await world.serverSnapshot())).toBe('playing');

    await world.runFor(60);
    await world.assertConverged();

    const server = await world.serverSnapshot();
    expect(matchClockStatus(server)).toBe('flagged');
    expect(matchClockWinner(server)).toBe('black');
    expect(matchClockStatus(a.snapshot())).toBe('flagged');
    expect(matchClockStatus(b.snapshot())).toBe('flagged');
    expect(a.hash()).toBe(await world.serverHash());
  });

  test('MC-02: move before flag cancels; opponent clock active', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? 'mc-02',
      module: MatchClockFixtureModule,
      startMs: 20_000,
    });
    const white = await world.addClient({ id: 'white', identity: 'white' });
    await world.addClient({ id: 'black', identity: 'black' });
    await world.assertConverged();

    white.dispatch(StartMatch({ whiteMs: 100, blackMs: 100 }));
    await world.drain();
    await world.runFor(30);
    white.dispatch(Move({}));
    await world.drain();

    const server = await world.serverSnapshot();
    expect(matchClockStatus(server)).toBe('playing');
    expect(matchClockTurn(server)).toBe('black');
    expect(matchClockWhiteMs(server)).toBe(70);
    expect(matchClockBlackMs(server)).toBe(100);

    await world.runFor(40);
    expect(matchClockStatus(await world.serverSnapshot())).toBe('playing');

    await world.runFor(70);
    await world.assertConverged();
    expect(matchClockStatus(await world.serverSnapshot())).toBe('flagged');
    expect(matchClockWinner(await world.serverSnapshot())).toBe('white');
  });

  test('MC-03: lagging held client cannot move after server flag', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? 'mc-03',
      module: MatchClockFixtureModule,
      startMs: 30_000,
    });
    const white = await world.addClient({ id: 'white', identity: 'white' });
    const black = await world.addClient({ id: 'black', identity: 'black' });
    await world.assertConverged();

    white.dispatch(StartMatch({ whiteMs: 40, blackMs: 40 }));
    await world.drain();

    {
      using _hold = world.net('white').set('hold');
      await world.runFor(50);
      expect(matchClockStatus(await world.serverSnapshot())).toBe('flagged');
      white.dispatch(Move({}));
      await world.drain();
    }

    await world.assertConverged();
    expect(matchClockStatus(await world.serverSnapshot())).toBe('flagged');
    expect(matchClockWinner(await world.serverSnapshot())).toBe('black');
    expect(white.hash()).toBe(await world.serverHash());
    expect(black.hash()).toBe(await world.serverHash());
  });

  test('MC-04: early client FlagFall rejected; server still flags at at', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? 'mc-04',
      module: MatchClockFixtureModule,
      startMs: 40_000,
    });
    const white = await world.addClient({ id: 'white', identity: 'white' });
    await world.addClient({ id: 'black', identity: 'black' });
    await world.assertConverged();

    white.dispatch(StartMatch({ whiteMs: 80, blackMs: 80 }));
    await world.drain();
    white.dispatch(FlagFall({ seat: 'white' }));
    await world.drain();
    expect(matchClockStatus(await world.serverSnapshot())).toBe('playing');

    await world.runFor(90);
    await world.assertConverged();
    expect(matchClockStatus(await world.serverSnapshot())).toBe('flagged');
    expect(matchClockWinner(await world.serverSnapshot())).toBe('black');
  });

  test('MC-05: soft disconnect during tick; reconnect after flag', async () => {
    await using world = await openWorld({
      seed: process.env['SIM_SEED'] ?? 'mc-05',
      module: MatchClockFixtureModule,
      startMs: 50_000,
    });
    const white = await world.addClient({ id: 'white', identity: 'white' });
    await world.addClient({ id: 'black', identity: 'black' });
    await world.assertConverged();

    white.dispatch(StartMatch({ whiteMs: 40, blackMs: 40 }));
    await world.drain();
    await world.node('white').disconnect();
    await world.runFor(50);
    expect(matchClockStatus(await world.serverSnapshot())).toBe('flagged');
    await world.node('white').reconnect();
    await world.assertConverged();
    expect(matchClockStatus(white.snapshot())).toBe('flagged');
    expect(white.hash()).toBe(await world.serverHash());
  });

  test('MC-06: seeded clock workload ×2 identical serverHash', async () => {
    const seed = process.env['SIM_SEED'] ?? 'mc-06';
    const run = async (): Promise<string> => {
      await using world = await openWorld({
        seed,
        module: MatchClockFixtureModule,
        startMs: 60_000,
      });
      const white = await world.addClient({ id: 'white', identity: 'white' });
      const black = await world.addClient({ id: 'black', identity: 'black' });
      await world.assertConverged();
      white.dispatch(StartMatch({ whiteMs: 100, blackMs: 100 }));
      await world.drain();
      await world.runFor(20);
      white.dispatch(Move({}));
      await world.drain();
      await world.runFor(15);
      black.dispatch(Move({}));
      await world.drain();
      await world.runFor(200);
      await world.assertConverged();
      return world.serverHash();
    };
    const h1 = await run();
    const h2 = await run();
    expect(h1).toBe(h2);
  });
});
