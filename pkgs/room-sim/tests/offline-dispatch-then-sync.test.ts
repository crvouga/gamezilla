import { describe, expect, test } from 'bun:test';
import {
  addClient,
  connect,
  connected,
  counterSystem,
  counterValue,
  disconnect,
  dispatch,
  expectHashMatch,
  expectInSync,
  Increment,
  readClient,
  readServer,
} from '@pkgs/room-sim';

describe('room sim: offline dispatch then sync', () => {
  test('optimistic increment flushes after reconnect', async () => {
    await using s = await counterSystem.run({ seed: 4 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectInSync(s);

    await s.apply(disconnect, 'alice');
    expect(((await s.read(connected)) as string[]).includes('alice')).toBe(
      false
    );
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);

    await s.advanceTime(100);
    expect(counterValue(await readClient(s, 'bob'))).not.toBe(1);

    await s.apply(connect, 'alice');
    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
