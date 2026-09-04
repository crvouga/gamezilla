import { describe, expect, test } from 'bun:test';
import {
  addClient,
  armCrashAt,
  counterSystem,
  counterValue,
  crash,
  disconnect,
  dispatch,
  expectHashMatch,
  expectInSync,
  Increment,
  readClient,
  readServer,
  restart,
  serverCrash,
  serverCrashed,
  serverRestart,
} from '@pkgs/room/sim';

describe('room sim: client/server crash restart', () => {
  test('client crash keeps local queue; restart + settle staysInSync', async () => {
    await using s = await counterSystem.run({
      seed: 'crash-client-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectInSync(s);

    await s.apply(disconnect, 'alice');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(crash, 'alice');

    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.advanceTime(0);

    await s.apply(restart, 'alice');
    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(2);
    expect(counterValue(await readClient(s, 'alice'))).toBe(2);
    await expectHashMatch(s, 'alice');
  });

  test('server crash + restart hydrates log and staysInSync', async () => {
    await using s = await counterSystem.run({
      seed: 'crash-server-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.advanceTime(0);
    expect(counterValue(await readServer(s))).toBe(2);

    await s.apply(serverCrash);
    expect(await s.read(serverCrashed)).toBe(true);
    await s.apply(serverRestart);
    expect(await s.read(serverCrashed)).toBe(false);
    expect(counterValue(await readServer(s))).toBe(2);

    await expectInSync(s);
    await expectHashMatch(s, 'alice');
  });

  test('boundary afterNextCommitted crashes client; settle restores', async () => {
    await using s = await counterSystem.run({
      seed: 'boundary-committed-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(armCrashAt, {
      clientId: 'alice',
      event: 'afterNextCommitted' as const,
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.advanceTime(0);
    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(1);
  });

  test('checkInvariants passes on healthy run', async () => {
    await using s = await counterSystem.run({
      seed: 'inv-1',
    });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.advanceTime(0);
    await expectInSync(s);
  });
});
