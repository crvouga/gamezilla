import { describe, expect, test } from 'bun:test';
import {
  addClient,
  clock,
  commandWire,
  counterSystem,
  counterValue,
  expectHashMatch,
  expectInSync,
  Increment,
  injectToServer,
  logSeq,
  readClient,
  readServer,
  takeOver,
} from '@pkgs/room/sim';

describe('room sim: command-id replay dedup (E-B02)', () => {
  test('same commandId applies once across reconnect storm', async () => {
    await using s = await counterSystem.run({
      seed: 42,
    });
    for (const id of ['alice', 'bob']) {
      await s.apply(addClient, { id });
    }
    await expectInSync(s);

    const frame = commandWire({
      id: 'fixed-cmd-1',
      ts: await s.read(clock),
      payload: Increment({}),
    });
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);

    for (let i = 0; i < 5; i += 1) {
      await s.apply(injectToServer, {
        clientId: 'alice',
        raw: frame,
        direct: true,
      });
    }
    await s.apply(takeOver, 'alice');
    await s.apply(injectToServer, {
      clientId: 'alice',
      raw: frame,
      direct: true,
    });

    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
    expect(await s.read(logSeq)).toBe(1);
  });
});
