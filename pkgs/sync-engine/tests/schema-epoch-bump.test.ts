import { describe, test } from 'bun:test';
import {
  addClient,
  disconnect,
  exampleSystem,
  expectInSync,
  expectLiveNoteAt,
  liveNote,
  mutate,
  neverExample,
  restart,
  SCHEMA_EPOCH,
  setNote,
} from '@pkgs/sync-engine/sim';

describe('schema epoch bump', () => {
  test('wipes the local cache but keeps queued writes, then re-hydrates', async () => {
    const seed = 710;
    await using s = await exampleSystem.run({
      seed,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(addClient, 'bob');

    await s.apply(mutate, 'bob', setNote, { id: 'peer', body: 'from-bob' });
    await expectInSync(s);

    await s.apply(disconnect, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'queued' });
    await neverExample(s, (s) => liveNote(s, 'server', 'n1'), {
      forMs: 50,
      pred: (v) => v !== null,
    });

    await s.apply(restart, 'alice', {
      preserveLocalDb: true,
      schemaEpoch: SCHEMA_EPOCH + 1,
    });
    await expectInSync(s);

    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'queued' });
    await expectLiveNoteAt(s, 'alice', 'peer', { body: 'from-bob' });
    await expectLiveNoteAt(s, 'bob', 'n1', { body: 'queued' });
    await expectLiveNoteAt(s, 'server', 'n1', { body: 'queued' });
  });
});
