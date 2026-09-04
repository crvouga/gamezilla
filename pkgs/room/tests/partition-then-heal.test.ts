import { describe, expect, test } from 'bun:test';
import {
  addClient,
  counterSystem,
  counterValue,
  dispatch,
  expectHashMatch,
  expectInSync,
  Increment,
  pauseNetwork,
  readClient,
  readClientHash,
  readServer,
  resumeNetwork,
} from '@pkgs/room/sim';

describe('room sim: partition then restoreNetwork', () => {
  test('held peer never sees write until restoreNetwork + converge', async () => {
    await using s = await counterSystem.run({ seed: 3 });
    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });
    await expectInSync(s);
    const bobBefore = await readClientHash(s, 'bob');

    await s.apply(pauseNetwork, 'bob');
    await s.apply(dispatch, {
      clientId: 'alice',
      payload: Increment({}),
    });
    await s.advanceTime(200);
    expect(counterValue(await readClient(s, 'bob'))).toBe(0);
    expect(await readClientHash(s, 'bob')).toBe(bobBefore);
    await s.apply(resumeNetwork, 'bob');

    await expectInSync(s);
    expect(counterValue(await readServer(s))).toBe(1);
    expect(counterValue(await readClient(s, 'alice'))).toBe(1);
    expect(counterValue(await readClient(s, 'bob'))).toBe(1);
    await expectHashMatch(s, 'alice');
  });
});
