import { expect, test } from 'bun:test';
import { chessPuzzleImport } from '@libs/chess-puzzle-shared/puzzle-import-query';
import { puzzleUploadKey } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { CHESS_TOPIC_MAP } from '@libs/chess-root-shared/topic-map';
import sql, { type Sql } from '@pkgs/sql-root-shared/sql';
import { partitionFanoutRowsByTopic } from '@pkgs/sync-engine-shared/partition-fanout-rows';
import { HEADER, openPuzzleImportHost, SAMPLE } from './puzzle-import-host';

// regression: deploy-empty-chess-puzzle-catalog
// regression: puzzle-import-undeclared-permission
test('an empty environment loads validated puzzles from staged source and upserts a refreshed source', async () => {
  await using host = await openPuzzleImportHost();
  await host.stage(
    'first',
    0,
    `${HEADER}\n${SAMPLE}\n${SAMPLE.replace('one,', 'duplicate,')}\n${SAMPLE.replace('d2c3 d4g1', 'd2c3 a1a8')}\n`
  );
  await host.start('first');
  expect(await host.job()).toMatchObject({
    status: 'adding',
    processed_rows: 0,
  });
  await host.drain();
  expect(await host.job()).toMatchObject({
    status: 'finished',
    processed_rows: 3,
    inserted_rows: 1,
    failed_rows: 1,
    duplicate_rows: 1,
  });
  await host.stage(
    'refresh',
    0,
    `${HEADER}\n${SAMPLE.replace(',1275,', ',1500,')}\n`
  );
  await host.start('refresh');
  await host.drain();
  expect(await host.job()).toMatchObject({
    status: 'finished',
    updated_rows: 1,
  });
  expect(
    await host.db.query(
      sql<{ id: string; rating: number }>`SELECT id, rating FROM chess_puzzles`
    )
  ).toEqual([{ id: 'one', rating: 1500 }]);
}, 30_000);

test('stop keeps committed work and prevents queued or stale work from changing a new job', async () => {
  await using host = await openPuzzleImportHost();
  await host.stage('first', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.stage(
    'first',
    1,
    `${HEADER}\n${SAMPLE.replace(',1275,', ',1400,')}\n`
  );
  await host.start('first', 2);
  await host.drain();
  expect(await host.job()).toMatchObject({
    status: 'adding',
    completed_chunks: 1,
  });
  await host.stop('first');
  await host.drain();
  expect(await host.job()).toMatchObject({
    status: 'stopped',
    inserted_rows: 1,
    updated_rows: 0,
  });
  expect(
    await host.db.query(
      sql<{ rating: number }>`SELECT rating FROM chess_puzzles`
    )
  ).toEqual([{ rating: 1275 }]);
  await host.stage('second', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.start('second');
  await host.stop('first');
  expect(await host.job()).toMatchObject({
    status: 'adding',
    source_etag: 'second',
  });
}, 30_000);

test('malformed or missing source fails visibly while preserving earlier puzzles', async () => {
  await using host = await openPuzzleImportHost();
  await host.stage('first', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.stage('first', 1, 'incorrect,header\none,two\n');
  await host.start('first', 2);
  await host.drain();
  await host.drain();
  expect(await host.job()).toMatchObject({
    status: 'failed',
    inserted_rows: 1,
  });
  expect((await host.job())?.error).toContain('original header');
  expect(
    await host.db.query(sql<{ id: string }>`SELECT id FROM chess_puzzles`)
  ).toEqual([{ id: 'one' }]);
  await host.start('missing');
  await host.drain();
  expect(await host.job()).toMatchObject({ status: 'failed' });
  expect((await host.job())?.error).toContain('incomplete');
}, 30_000);

test('permission decisions guard starting, stopping and status, and concurrent starts serialize', async () => {
  await using host = await openPuzzleImportHost();
  await expect(host.start('outsider', 1, 'outsider')).rejects.toThrow(
    'Permission denied'
  );
  await expect(host.stop('first', 'outsider')).rejects.toThrow(
    'Permission denied'
  );
  const db = {
    query: (query: Sql<unknown>) =>
      host.db.query(query as Sql<Record<string, unknown>>),
  };
  expect(
    await chessPuzzleImport.authorize?.({ db, env: host.env('outsider') }, {})
  ).toBe(false);
  expect(
    await chessPuzzleImport.authorize?.({ db, env: host.env('manager') }, {})
  ).toBe(true);
  const starts = await Promise.allSettled([
    host.start('first'),
    host.start('second'),
  ]);
  expect(starts.filter((result) => result.status === 'fulfilled')).toHaveLength(
    1
  );
  expect(starts.filter((result) => result.status === 'rejected')).toHaveLength(
    1
  );
}, 30_000);

test('background puzzle writes wake the shared catalog and the manager status', async () => {
  // regression: outbox-catalog-topic-invalidation
  await using host = await openPuzzleImportHost();
  await host.stage('shared', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.start('shared');
  await host.drainAndNotify();
  expect(host.published.map((item) => item.topic)).toContain(
    'system:chess_puzzles'
  );
  expect(host.published.map((item) => item.topic)).toContain('user:manager');
  expect(
    host.published.find((item) => item.topic === 'system:chess_puzzles')?.data
  ).toMatchObject({
    tables: expect.arrayContaining(['chess_puzzles', 'chess_puzzle_load']),
  });
}, 30_000);

// regression: puzzle-import-status-public-fanout
test('load status row images reach the management audience without entering the public puzzle catalog', async () => {
  await using host = await openPuzzleImportHost();
  await host.stage('private', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.start('private');
  const job = await host.job();
  if (!job) throw new Error('Import did not start');
  const fanout = await partitionFanoutRowsByTopic({
    topicMap: CHESS_TOPIC_MAP,
    ctx: {
      actorId: 'manager',
      accountId: 'manager',
      deviceId: 'phone',
      isAnon: false,
    },
    rows: { chess_puzzle_load: [job] },
    db: host.db,
  });
  expect([...fanout.keys()]).toEqual(['user:manager', 'user:other-manager']);
}, 30_000);

test('finished, stopped and failed loads clean only their own staged source', async () => {
  await using host = await openPuzzleImportHost();
  await host.stage('unrelated', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.stage('finished', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.start('finished');
  await host.drain();
  await host.cleanup();
  expect(await host.store.listKeys()).toEqual([
    puzzleUploadKey('manager', 'unrelated', 0),
  ]);

  await host.stage('stopped', 0, `${HEADER}\n${SAMPLE}\n`);
  await host.start('stopped');
  await host.stop('stopped');
  await host.cleanup();
  expect(await host.store.listKeys()).toEqual([
    puzzleUploadKey('manager', 'unrelated', 0),
  ]);

  await host.stage('failed', 0, 'incorrect,header\none,two\n');
  await host.start('failed');
  await host.drain(); // Discard the queued work for the stopped load.
  await host.drain();
  expect(await host.job()).toMatchObject({ status: 'failed' });
  await host.cleanup();
  expect(await host.store.listKeys()).toEqual([
    puzzleUploadKey('manager', 'unrelated', 0),
  ]);
}, 30_000);
