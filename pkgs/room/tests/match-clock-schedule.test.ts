import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  disconnect,
  dispatch,
  expectHashMatch,
  expectInSync,
  FlagFall,
  Move,
  matchClockBlackMs,
  matchClockStatus,
  matchClockSystem,
  matchClockTurn,
  matchClockWhiteMs,
  matchClockWinner,
  pauseNetwork,
  readClient,
  readServer,
  resumeNetwork,
  roomEpoch,
  StartMatch,
  serverHash,
} from '@pkgs/room/sim';

async function bootMatch(seed: string, startTime: number) {
  const s = await matchClockSystem.run({
    seed,
    runtime: roomEpoch(matchClockSystem, startTime),
  });
  await s.apply(addClient, { id: 'white', identity: 'white' });
  await s.apply(addClient, { id: 'black', identity: 'black' });
  await expectInSync(s);
  return s;
}

describe('match-clock schedule (MC-01..06)', () => {
  test('MC-01: runFor past flag → server FlagFall terminal; clients converge', async () => {
    await using s = await bootMatch(process.env['SIM_SEED'] ?? 'mc-01', 10_000);
    await s.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 50, blackMs: 80 }),
    });
    expect(matchClockStatus(await readServer(s))).toBe('playing');

    await s.advanceTime(60);
    await expectInSync(s);

    const server = await readServer(s);
    expect(matchClockStatus(server)).toBe('flagged');
    expect(matchClockWinner(server)).toBe('black');
    expect(matchClockStatus(await readClient(s, 'white'))).toBe('flagged');
    expect(matchClockStatus(await readClient(s, 'black'))).toBe('flagged');
    await expectHashMatch(s, 'white');
  });

  test('MC-02: move before flag cancels; opponent clock active', async () => {
    await using s = await bootMatch(process.env['SIM_SEED'] ?? 'mc-02', 20_000);
    await s.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 100, blackMs: 100 }),
    });
    await s.advanceTime(30);
    await s.apply(dispatch, {
      clientId: 'white',
      payload: Move({}),
    });

    const server = await readServer(s);
    expect(matchClockStatus(server)).toBe('playing');
    expect(matchClockTurn(server)).toBe('black');
    expect(matchClockWhiteMs(server)).toBe(70);
    expect(matchClockBlackMs(server)).toBe(100);

    await s.advanceTime(40);
    expect(matchClockStatus(await readServer(s))).toBe('playing');

    await s.advanceTime(70);
    await expectInSync(s);
    expect(matchClockStatus(await readServer(s))).toBe('flagged');
    expect(matchClockWinner(await readServer(s))).toBe('white');
  });

  test('MC-03: lagging held client cannot move after server flag', async () => {
    await using s = await bootMatch(process.env['SIM_SEED'] ?? 'mc-03', 30_000);
    await s.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 40, blackMs: 40 }),
    });

    await s.apply(pauseNetwork, 'white');
    await s.advanceTime(50);
    expect(matchClockStatus(await readServer(s))).toBe('flagged');
    await s.apply(dispatch, {
      clientId: 'white',
      payload: Move({}),
    });
    await s.apply(resumeNetwork, 'white');

    await expectInSync(s);
    expect(matchClockStatus(await readServer(s))).toBe('flagged');
    expect(matchClockWinner(await readServer(s))).toBe('black');
    await expectHashMatch(s, 'white');
    await expectHashMatch(s, 'black');
  });

  test('MC-04: early client FlagFall rejected; server still flags at at', async () => {
    await using s = await bootMatch(process.env['SIM_SEED'] ?? 'mc-04', 40_000);
    await s.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 80, blackMs: 80 }),
    });
    await s.apply(dispatch, {
      clientId: 'white',
      payload: FlagFall({ seat: 'white' }),
    });
    expect(matchClockStatus(await readServer(s))).toBe('playing');

    await s.advanceTime(90);
    await expectInSync(s);
    expect(matchClockStatus(await readServer(s))).toBe('flagged');
    expect(matchClockWinner(await readServer(s))).toBe('black');
  });

  test('MC-05: soft disconnect during tick; reconnect after flag', async () => {
    await using s = await bootMatch(process.env['SIM_SEED'] ?? 'mc-05', 50_000);
    await s.apply(dispatch, {
      clientId: 'white',
      payload: StartMatch({ whiteMs: 40, blackMs: 40 }),
    });
    await s.apply(disconnect, 'white');
    await s.advanceTime(50);
    expect(matchClockStatus(await readServer(s))).toBe('flagged');
    await s.apply(connect, 'white');
    await expectInSync(s);
    expect(matchClockStatus(await readClient(s, 'white'))).toBe('flagged');
    await expectHashMatch(s, 'white');
  });

  test('MC-06: seeded clock workload ×2 identical serverHash', async () => {
    const seed = process.env['SIM_SEED'] ?? 'mc-06';
    const once = async (): Promise<string> => {
      await using s = await bootMatch(seed, 60_000);
      await s.apply(dispatch, {
        clientId: 'white',
        payload: StartMatch({ whiteMs: 100, blackMs: 100 }),
      });
      await s.advanceTime(20);
      await s.apply(dispatch, {
        clientId: 'white',
        payload: Move({}),
      });
      await s.advanceTime(15);
      await s.apply(dispatch, {
        clientId: 'black',
        payload: Move({}),
      });
      await s.advanceTime(200);
      await expectInSync(s);
      return s.read(serverHash);
    };
    expect(await once()).toBe(await once());
  });
});
