import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  hold,
  passTime,
  release,
  scriptRoom,
  serverHash,
} from '../../sim/scenario';
import { matchClockSystem } from '../apps/match-clock/system';
import { expectConverged } from '../expect-converged';
import {
  FlagFall,
  Move,
  matchClockBlackMs,
  matchClockStatus,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  StartMatch,
} from '../fixtures/match-clock-module';
import {
  expectHashMatch,
  readClient,
  readServer,
} from '../scenario/read-state';

async function bootMatch(seed: string, startTime: number) {
  const run = await scriptRoom(matchClockSystem, { seed, startTime });
  await run.apply(addClient, { id: 'white', identity: 'white' });
  await run.apply(addClient, { id: 'black', identity: 'black' });
  await expectConverged(run);
  return run;
}

describe('match-clock schedule (MC-01..06)', () => {
  test('MC-01: runFor past flag → server FlagFall terminal; clients converge', async () => {
    await using run = await bootMatch(
      process.env['SIM_SEED'] ?? 'mc-01',
      10_000
    );
    await run.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 50, blackMs: 80 }),
    });
    expect(matchClockStatus(await readServer(run))).toBe('playing');

    await run.apply(passTime, 60);
    await expectConverged(run);

    const server = await readServer(run);
    expect(matchClockStatus(server)).toBe('flagged');
    expect(matchClockWinner(server)).toBe('black');
    expect(matchClockStatus(await readClient(run, 'white'))).toBe('flagged');
    expect(matchClockStatus(await readClient(run, 'black'))).toBe('flagged');
    await expectHashMatch(run, 'white');
  });

  test('MC-02: move before flag cancels; opponent clock active', async () => {
    await using run = await bootMatch(
      process.env['SIM_SEED'] ?? 'mc-02',
      20_000
    );
    await run.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 100, blackMs: 100 }),
    });
    await run.apply(passTime, 30);
    await run.apply(dispatch, {
      clientId: 'white',
      payload: Move({}),
    });

    const server = await readServer(run);
    expect(matchClockStatus(server)).toBe('playing');
    expect(matchClockTurn(server)).toBe('black');
    expect(matchClockWhiteMs(server)).toBe(70);
    expect(matchClockBlackMs(server)).toBe(100);

    await run.apply(passTime, 40);
    expect(matchClockStatus(await readServer(run))).toBe('playing');

    await run.apply(passTime, 70);
    await expectConverged(run);
    expect(matchClockStatus(await readServer(run))).toBe('flagged');
    expect(matchClockWinner(await readServer(run))).toBe('white');
  });

  test('MC-03: lagging held client cannot move after server flag', async () => {
    await using run = await bootMatch(
      process.env['SIM_SEED'] ?? 'mc-03',
      30_000
    );
    await run.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 40, blackMs: 40 }),
    });

    await run.apply(hold, 'white');
    await run.apply(passTime, 50);
    expect(matchClockStatus(await readServer(run))).toBe('flagged');
    await run.apply(dispatch, {
      clientId: 'white',
      payload: Move({}),
    });
    await run.apply(release, 'white');

    await expectConverged(run);
    expect(matchClockStatus(await readServer(run))).toBe('flagged');
    expect(matchClockWinner(await readServer(run))).toBe('black');
    await expectHashMatch(run, 'white');
    await expectHashMatch(run, 'black');
  });

  test('MC-04: early client FlagFall rejected; server still flags at at', async () => {
    await using run = await bootMatch(
      process.env['SIM_SEED'] ?? 'mc-04',
      40_000
    );
    await run.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 80, blackMs: 80 }),
    });
    await run.apply(dispatch, {
      clientId: 'white',
      payload: FlagFall({ seat: 'white' }),
    });
    expect(matchClockStatus(await readServer(run))).toBe('playing');

    await run.apply(passTime, 90);
    await expectConverged(run);
    expect(matchClockStatus(await readServer(run))).toBe('flagged');
    expect(matchClockWinner(await readServer(run))).toBe('black');
  });

  test('MC-05: soft disconnect during tick; reconnect after flag', async () => {
    await using run = await bootMatch(
      process.env['SIM_SEED'] ?? 'mc-05',
      50_000
    );
    await run.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 40, blackMs: 40 }),
    });
    await run.apply(disconnect, 'white');
    await run.apply(passTime, 50);
    expect(matchClockStatus(await readServer(run))).toBe('flagged');
    await run.apply(connect, 'white');
    await expectConverged(run);
    expect(matchClockStatus(await readClient(run, 'white'))).toBe('flagged');
    await expectHashMatch(run, 'white');
  });

  test('MC-06: seeded clock workload ×2 identical serverHash', async () => {
    const seed = process.env['SIM_SEED'] ?? 'mc-06';
    const once = async (): Promise<string> => {
      await using run = await bootMatch(seed, 60_000);
      await run.apply(dispatch, {
        clientId: 'white',
        payload: StartMatch({ whiteMs: 100, blackMs: 100 }),
      });
      await run.apply(passTime, 20);
      await run.apply(dispatch, {
        clientId: 'white',
        payload: Move({}),
      });
      await run.apply(passTime, 15);
      await run.apply(dispatch, {
        clientId: 'black',
        payload: Move({}),
      });
      await run.apply(passTime, 200);
      await expectConverged(run);
      return run.observe(serverHash);
    };
    expect(await once()).toBe(await once());
  });
});
