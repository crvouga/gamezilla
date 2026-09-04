import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clock,
  commandWire,
  counterSystem,
  counterValue,
  dispatch,
  expectHashMatch,
  expectInSync,
  Increment,
  injectToServer,
  readClient,
  readServer,
  rosterSize,
  takeOver,
} from '@pkgs/room-sim';

describe('room sim: session take-over (E-C04)', () => {
  test('take-over mid-command does not double-apply', async () => {
    await using s = await counterSystem.run({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectInSync(s);

    const frame = commandWire({
      id: 'takeover-cmd',
      ts: await s.read(clock),
      payload: Increment({}),
    });
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });

    await s.apply(takeOver, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectInSync(s);

    expect(counterValue(await readServer(s))).toBe(2);
    expect(counterValue(await readClient(s, 'alice'))).toBe(2);
    expect(counterValue(await readClient(s, 'bob'))).toBe(2);
    await expectHashMatch(s, 'alice');
    expect(await s.read(rosterSize)).toBe(2);
  });
});
