import { describe, expect, test } from 'bun:test';
import {
  addClient,
  exampleSystem,
  expectInSync,
  lastMutationFailures,
  lastMutationId,
  lastMutationOk,
  lastMutationSettled,
  liveNote,
  outcome,
  pendingNote,
  startMutate,
  untilExample,
} from '@pkgs/sync-engine/sim';

describe('pendingUx pending answers with the server verdict', () => {
  test('mutate resolves only once the server has confirmed', async () => {
    await using s = await exampleSystem.run({
      seed: 520,
      args: { clientCount: 0 },
    });
    await s.apply(addClient, { id: 'alice' });

    await s.apply(startMutate, 'alice', pendingNote, {
      id: 'n1',
      body: 'fine',
    });
    // Applied on the device, yet the call has not returned: it waits for
    // the server, not for the local apply.
    await untilExample(
      s,
      async (s) => (await liveNote(s, 'alice', 'n1')) !== null
    );
    expect(await s.read(lastMutationSettled, 'alice')).toBe(false);
    await expectInSync(s);
    await untilExample(s, (s) => lastMutationSettled(s, 'alice'));
    expect(await s.read(lastMutationOk, 'alice')).toBe(true);
    const id = await s.read(lastMutationId, 'alice');
    expect(id).not.toBeNull();
    if (id === null) return;
    // No waiting after the call: the verdict is already in.
    expect(await s.read(outcome, 'alice', id)).toBe('confirmed');
  });

  test('a server refusal fails the call itself, with the server’s code', async () => {
    await using s = await exampleSystem.run({
      seed: 521,
      args: { clientCount: 0 },
    });
    await s.apply(addClient, { id: 'alice' });

    // The local apply passes; only the server knows `refused` is refused.
    await s.apply(startMutate, 'alice', pendingNote, {
      id: 'n1',
      body: 'refused',
    });
    await expectInSync(s);
    await untilExample(s, (s) => lastMutationSettled(s, 'alice'));
    expect(await s.read(lastMutationOk, 'alice')).toBe(false);
    expect(await s.read(lastMutationFailures, 'alice')).toContain('REFUSED');
  });
});
