import { describe, expect, test } from 'bun:test';
import { defineAction } from '@pkgs/sim';
import {
  addClient,
  connection,
  exampleLocalSchemaExtraColumn,
  exampleLocalSchemaExtraTable,
  exampleMutationRegistry,
  exampleQueryRegistry,
  exampleSystem,
  expectInSync,
  lastError,
  liveNote,
  localTable,
  mutate,
  noteColor,
  notesAllWithColorQuery,
  nudge,
  restartWithSchema,
  runSql,
  type SyncSim,
  setNote,
  setNoteColor,
} from '@pkgs/sync-engine/sim';

const extraColumnMutationRegistry = {
  ...exampleMutationRegistry,
  [setNoteColor.name]: setNoteColor,
};
const extraColumnQueryRegistry = {
  ...exampleQueryRegistry,
  [notesAllWithColorQuery.name]: notesAllWithColorQuery,
};

const upgradeServerWithColor = defineAction({
  name: 'upgradeServerWithColor',
  act: async (s: SyncSim): Promise<void> => {
    await s.node('server').restart({
      preserveLocalDb: true,
      localSchema: exampleLocalSchemaExtraColumn,
      mutationRegistry: extraColumnMutationRegistry,
      queryRegistry: extraColumnQueryRegistry,
    });
  },
});

const upgradeClientWithColor = defineAction({
  name: 'upgradeClientWithColor',
  act: async (s: SyncSim): Promise<void> => {
    await s.node('alice').restart({
      preserveLocalDb: true,
      localSchema: exampleLocalSchemaExtraColumn,
      mutationRegistry: extraColumnMutationRegistry,
      queryRegistry: extraColumnQueryRegistry,
      sessionQuery: { name: notesAllWithColorQuery.name, params: {} },
    });
  },
});

describe('schema drift on the real merge path', () => {
  test('server-added column is merged by a client after schema upgrade', async () => {
    await using s = await exampleSystem.run({
      seed: 73_001,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'before-upgrade',
    });
    await expectInSync(s);

    await s.apply(upgradeServerWithColor);
    await s.apply(
      runSql,
      'server',
      "UPDATE notes SET color = 'blue' WHERE id = 'n1'"
    );

    // Reopen the existing client with the additive schema, then sweep the
    // color-bearing session query. This is the rolling-upgrade path: the
    // server has the column first, and the client learns it on merge.
    await s.apply(upgradeClientWithColor);
    await s.apply(nudge, 'alice');

    expect(await s.read(noteColor, 'alice', 'n1')).toEqual([{ color: 'blue' }]);
    expect(await s.read(lastError, 'alice')).toBeNull();
    await expectInSync(s);
  });

  test('a client-only column survives a full merge', async () => {
    await using s = await exampleSystem.run({
      seed: 73_002,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, {
      id: 'alice',
      actorId: 'alice',
      localSchema: exampleLocalSchemaExtraColumn,
      mutationRegistry: extraColumnMutationRegistry,
      queryRegistry: extraColumnQueryRegistry,
    });
    await s.apply(addClient, 'bob');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'initial' });
    await expectInSync(s);

    // The server snapshot never carries color. A subsequent merge must not
    // synthesize NULL for the local-only value.
    await s.apply(
      runSql,
      'alice',
      "UPDATE notes SET color = 'red' WHERE id = 'n1'"
    );
    await s.apply(mutate, 'bob', setNote, { id: 'n1', body: 'server-update' });
    await expectInSync(s);

    expect((await s.read(liveNote, 'alice', 'n1'))?.body).toBe('server-update');
    expect(await s.read(noteColor, 'alice', 'n1')).toEqual([{ color: 'red' }]);
    expect(await s.read(lastError, 'alice')).toBeNull();
  });

  test('stale extra-column bundle recovers when restarted on baseline', async () => {
    await using s = await exampleSystem.run({
      seed: 73_003,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(restartWithSchema, 'alice', 'extraColumn');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'written-v2' });
    await s.apply(
      runSql,
      'alice',
      "UPDATE notes SET color = 'green' WHERE id = 'n1'"
    );

    await s.apply(restartWithSchema, 'alice', 'baseline');

    expect(await s.read(lastError, 'alice')).toBeNull();
    expect(await s.read(connection, 'alice')).toBe('connected');
    expect((await s.read(liveNote, 'alice', 'n1'))?.body).toBe('written-v2');
    expect(await s.read(noteColor, 'alice', 'n1')).toEqual([
      { color: 'green' },
    ]);
    await expectInSync(s);
  });

  test('unknown extra table is skipped across a baseline restart', async () => {
    await using s = await exampleSystem.run({
      seed: 73_004,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, {
      id: 'n1',
      body: 'before-table-upgrade',
    });
    await expectInSync(s);

    await s.apply(restartWithSchema, 'alice', 'extraTable');
    expect(await s.read(localTable, 'alice', 'tags')).toHaveLength(1);
    await s.apply(restartWithSchema, 'alice', 'baseline');
    expect(await s.read(localTable, 'alice', 'tags')).toHaveLength(1);

    expect(await s.read(lastError, 'alice')).toBeNull();
    expect(await s.read(connection, 'alice')).toBe('connected');
    expect((await s.read(liveNote, 'alice', 'n1'))?.body).toBe(
      'before-table-upgrade'
    );
    await expectInSync(s);
  });
});
