import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeKnobs,
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
  syncVirtualHost,
} from '../apps/acme';

describe('preserveLocalDb remigrate after additive schema', () => {
  test('restart without localSchema keeps extra column (no drift fail)', async () => {
    await using run = await start(acmeSystem, {
      seed: 42,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, {
      id: 'alice',
      localSchema: acmeLocalSchemaExtraColumn,
    });
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'hi' });
    await expectConverged(run);

    // Settle-style remigrate: preserve DB, omit localSchema (pack baseline).
    // Must reuse sticky upgrade schema — baseline reconcile would reject color.
    await run.apply(restart, 'alice', { preserveLocalDb: true });

    const cols = await run.observe(noteColumns('alice'));
    expect(cols.some((c) => c.name === 'color')).toBe(true);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'hi' });
    await expectNotesAgree(run, 'alice');
  });

  test('restartWithSchema then crash+preserve remigrate converges', async () => {
    await using run = await start(acmeSystem, {
      seed: 43,
      host: syncVirtualHost(),
      knobs: acmeKnobs({
        clientCount: 0,
        rowImageFanout: false,
        liveResendOnReconnect: false,
        bufferOutboundLive: false,
      }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(addClient, { id: 'bob' });

    await run.apply(restartWithSchema, 'alice', 'extraColumn');
    await run.apply(mutate, 'alice', setNote, { id: 'n0', body: 'from-a' });
    await run.apply(mutate, 'bob', setNote, { id: 'n1', body: 'from-b' });

    await run.apply(crash, 'alice');
    await run.apply(restart, 'alice', { preserveLocalDb: true });

    await expectConverged(run);
    await expectNotesAgree(run, 'alice');
    await expectNotesAgree(run, 'bob');
  });

  test('extraColumn then extraTable remigrate drops color via deprecation', async () => {
    await using run = await start(acmeSystem, {
      seed: 44,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'alice' });
    await run.apply(restartWithSchema, 'alice', 'extraColumn');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'keep' });
    await expectConverged(run);

    await run.apply(restartWithSchema, 'alice', 'extraTable');

    const cols = await run.observe(noteColumns('alice'));
    expect(cols.some((c) => c.name === 'color')).toBe(false);
    expect(await hasLocalTable(run, 'alice', 'tags')).toBe(true);
    await expectLiveNoteAt(run, 'alice', 'n1', { body: 'keep' });
    await expectNotesAgree(run, 'alice');
  });

  test('addPeerEngine inherits sticky schema from shared extraColumn db', async () => {
    await using run = await start(acmeSystem, {
      seed: 45,
      host: syncVirtualHost(),
      knobs: acmeKnobs({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, { id: 'c1' });
    await run.apply(restartWithSchema, 'c1', 'extraColumn');
    await run.apply(mutate, 'c1', setNote, { id: 'n1', body: 'peer' });
    await expectConverged(run);

    await run.apply(addPeerEngine, 'c2', 'c1');

    await expectLiveNoteAt(run, 'c2', 'n1', { body: 'peer' });
    await expectConverged(run);
  });
});
