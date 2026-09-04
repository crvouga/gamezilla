import { describe, expect, test } from 'bun:test';
import {
  acmeLocalSchemaExtraColumn,
  acmeSystem,
  addClient,
  addPeerEngine,
  crash,
  expectConverged,
  expectLiveNoteAt,
  expectNotesAgree,
  hasLocalTable,
  mutate,
  noteColumns,
  restart,
  restartWithSchema,
  setNote,
} from '../apps/acme';

describe('preserveLocalDb remigrate after additive schema', () => {
  test('restart without localSchema keeps extra column (no drift fail)', async () => {
    await using s = await acmeSystem.script({
      seed: 42,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      localSchema: acmeLocalSchemaExtraColumn,
    });
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hi' });
    await expectConverged(s);

    // Settle-style remigrate: preserve DB, omit localSchema (pack baseline).
    // Must reuse sticky upgrade schema — baseline reconcile would reject color.
    await s.apply(restart, 'alice', { preserveLocalDb: true });

    const cols = await s.observe(noteColumns, 'alice');
    expect(cols.some((c) => c.name === 'color')).toBe(true);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'hi' });
    await expectNotesAgree(s, 'alice');
  });

  test('restartWithSchema then crash+preserve remigrate converges', async () => {
    await using s = await acmeSystem.script({
      seed: 43,
      args: {
        clientCount: 0,
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
      },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(addClient, { id: 'bob' });

    await s.apply(restartWithSchema, 'alice', 'extraColumn');
    await s.apply(mutate, 'alice', setNote, { id: 'n0', body: 'from-a' });
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });

    await s.apply(crash, 'alice');
    await s.apply(restart, 'alice', { preserveLocalDb: true });

    await expectConverged(s);
    await expectNotesAgree(s, 'alice');
    await expectNotesAgree(s, 'bob');
  });

  test('extraColumn then extraTable remigrate drops color via deprecation', async () => {
    await using s = await acmeSystem.script({
      seed: 44,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'alice' });
    await s.apply(restartWithSchema, 'alice', 'extraColumn');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep' });
    await expectConverged(s);

    await s.apply(restartWithSchema, 'alice', 'extraTable');

    const cols = await s.observe(noteColumns, 'alice');
    expect(cols.some((c) => c.name === 'color')).toBe(false);
    expect(await hasLocalTable(s, 'alice', 'tags')).toBe(true);
    await expectLiveNoteAt(s, 'alice', 'n1', { body: 'keep' });
    await expectNotesAgree(s, 'alice');
  });

  test('addPeerEngine inherits sticky schema from shared extraColumn db', async () => {
    await using s = await acmeSystem.script({
      seed: 45,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, { id: 'c1' });
    await s.apply(restartWithSchema, 'c1', 'extraColumn');
    await s.apply(mutate, 'c1', setNote, { id: 'n1', body: 'peer' });
    await expectConverged(s);

    await s.apply(addPeerEngine, 'c2', 'c1');

    await expectLiveNoteAt(s, 'c2', 'n1', { body: 'peer' });
    await expectConverged(s);
  });
});
