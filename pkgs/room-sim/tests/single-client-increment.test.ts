import { describe, expect, test } from 'bun:test';
import {
  addClient,
  counterSystem,
  counterValue,
  dispatch,
  expectHashMatch,
  expectInSync,
  Increment,
  readClient,
  readServer,
} from '@pkgs/room-sim';

describe('room sim: single client increment', () => {
  test('increment staysInSync to server hash', async () => {
    await using s = await counterSystem.run({ seed: 1 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
