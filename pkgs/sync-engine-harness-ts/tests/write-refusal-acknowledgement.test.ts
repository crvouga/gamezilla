import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { pendingNote } from '@pkgs/sync-engine-harness-ts/mutations';
import { exampleMutationRegistry } from '@pkgs/sync-engine-harness-ts/registries';
import {
  addClient,
  mutate,
  startMutate,
} from '@pkgs/sync-engine-harness-ts/regression-actions';
import type { SyncHarness } from '@pkgs/sync-engine-harness-ts/scenario-system';
import {
  rejections,
  rows,
} from '@pkgs/sync-engine-harness-ts/sync-observations';
import { acknowledgeWriteRejectionMutation } from '@pkgs/sync-engine-shared-ts/acknowledge-write-rejection';

// An instant write: `mutate()` answers on the local apply, so its caller
// never hears the server refuse it.
const instantNote = { ...pendingNote, pendingUx: 'instant' as const };
const NOTE = { id: 'Groceries', title: 'Groceries' };
const WAIT_MS = 15_000;

type Run = Awaited<ReturnType<typeof exampleSystem.run>>;

async function refuseAliceOnce(s: Run) {
  await s.apply(addClient, {
    id: 'alice',
    mutationRegistry: {
      ...exampleMutationRegistry,
      [instantNote.name]: instantNote,
    },
  });
  await s.apply(mutate, 'alice', instantNote, { ...NOTE, body: 'refused' });
  const [notice] = await s.until((h) => rejections(h, 'alice'), {
    maxMs: WAIT_MS,
    pred: (found) => found.length > 0,
  });
  if (notice === undefined) throw new Error('Alice was not refused');
  return notice;
}

function serverRefusals(s: Run) {
  return s.until(
    (h) =>
      rows(
        h,
        'server-refusals',
        'server',
        sql`SELECT acknowledged FROM sync_engine_write_rejections`
      ),
    {
      maxMs: WAIT_MS,
      pred: (found) =>
        found.length > 0 &&
        found.every((row) => Number(Object(row).acknowledged) === 1),
    }
  );
}

function watchUnheard(s: SyncHarness, actor: string) {
  const client = s.clients.get(actor);
  if (client === undefined) throw new Error(`No client ${actor}`);
  return client.engine.unheardRefusals();
}

test('acknowledging a refusal on the device acknowledges it where it is kept for everyone', async () => {
  // regression: write-rejections-never-acknowledged
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  const notice = await refuseAliceOnce(s);
  await s.apply(mutate, 'alice', acknowledgeWriteRejectionMutation, {
    mutationId: notice.mutationId,
  });
  expect(await serverRefusals(s)).toEqual([{ acknowledged: 1 }]);
  expect(await s.read(rejections, 'alice')).toEqual([]);
});

test('a refused instant write stays unheard until acknowledged; a refused pending one is never unheard', async () => {
  // regression: refused-instant-write-silently-undone
  await using s = await exampleSystem.run({
    seed: 1,
    args: { clientCount: 0 },
  });
  const notice = await refuseAliceOnce(s);
  const unheard = await s.read(watchUnheard, 'alice');
  const stop = unheard.subscribe(() => undefined);
  const shown = await s.until(() => unheard.getSnapshot(), {
    maxMs: WAIT_MS,
    pred: (found) => found.length > 0,
  });
  expect(shown).toEqual([
    {
      mutationId: notice.mutationId,
      mutationName: instantNote.name,
      code: 'REFUSED',
      message: 'The server refuses this body.',
    },
  ]);
  await s.apply(mutate, 'alice', acknowledgeWriteRejectionMutation, {
    mutationId: notice.mutationId,
  });
  await s.until(() => unheard.getSnapshot(), {
    maxMs: WAIT_MS,
    pred: (found) => found.length === 0,
  });
  stop();
  // Bob's write is pending: his `mutate()` answers with the refusal itself.
  await s.apply(addClient, 'bob');
  const bobUnheard = await s.read(watchUnheard, 'bob');
  const stopBob = bobUnheard.subscribe(() => undefined);
  await s.apply(startMutate, 'bob', pendingNote, { ...NOTE, body: 'refused' });
  await s.until((h) => rejections(h, 'bob'), {
    maxMs: WAIT_MS,
    pred: (found) => found.length > 0,
  });
  await s.until(() => bobUnheard.getHydrated());
  expect(bobUnheard.getSnapshot()).toEqual([]);
  stopBob();
});
