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
  rosterSize,
} from '@pkgs/room/sim';

describe('room sim: two client converge', () => {
  test('mutual increments yield equal hashes and roster', async () => {
    await using s = await counterSystem.run({ seed: 2 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'bob',
      payload: Increment({}),
    });
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(3);
    expect(counterValue(await readClient(s, 'alice'))).toBe(3);
    expect(counterValue(await readClient(s, 'bob'))).toBe(3);
    await expectHashMatch(s, 'alice');
    expect(await s.read(rosterSize)).toBe(2);
  });
});
