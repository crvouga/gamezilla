import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

import { ChessPuzzleValidationJob } from '@libs/chess-puzzle-server/chess-puzzle-validation-job';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { createLogger } from '@pkgs/logger-shared/logger';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';

const PACKAGE_ROOT = join(import.meta.dir, '..');

/** Every checked-in puzzle fixture CSV the seeders load (§35 job input). */
const FIXTURE_CSVS = [
  join(PACKAGE_ROOT, 'scripts/fixtures/chess-puzzles.load.csv'),
  join(
    PACKAGE_ROOT,
    '../chess-puzzle-server/scripts/fixtures/lichess-puzzles-sample.csv'
  ),
  join(PACKAGE_ROOT, 'fixtures/chess-puzzles.harness.csv'),
  join(PACKAGE_ROOT, 'fixtures/chess-puzzles-motifs.harness.csv'),
  join(PACKAGE_ROOT, 'fixtures/chess-puzzles-rating.harness.csv'),
  join(PACKAGE_ROOT, 'fixtures/chess-puzzles-selection.harness.csv'),
];

const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
const FEN = '6k1/5p1p/1p4p1/p1bN1p2/2Pq1P2/1P5P/1P1Q2P1/7K w - - 1 32';
const BAD_CSV = [
  HEADER,
  `ok1,${FEN},d2c3 d4g1,1275,112,100,43,mate,,`,
  `dup,${FEN.replace(' 1 32', ' 0 9')},d2c3 d4g1,1275,112,100,43,mate,,`,
  `odd,${FEN},d2c3,1275,112,100,43,mate,,`,
  `ill,${FEN},d2c3 g1g2,1275,112,100,43,mate,,`,
  `fen,not-a-fen,d2c3 d4g1,1275,112,100,43,mate,,`,
].join('\n');

const noHttp: HttpClient = {
  fetch: () => Promise.reject(new Error('no network in this test')),
};

function job(sources: readonly string[], store: ObjectStoreImplInMemory) {
  return new ChessPuzzleValidationJob(
    { sources, database: false, cacheDir: '/cache' },
    {
      clock: createHarnessClock().clock,
      http: noHttp,
      log: createLogger({ name: 'test', level: 'silent', now: () => 0 }),
    },
    {
      configStore: store,
      sourceStore: store,
      cacheStoreForDir: () => store,
    }
  );
}

describe('§35 validation job', () => {
  test('reports each invalid row by reason (and fails)', async () => {
    const store = new ObjectStoreImplInMemory();
    await writeUtf8(store, 'in/bad.csv', BAD_CSV, 'text/csv');
    const summary = await job(['/in/bad.csv'], store).run();
    expect(summary).toMatchObject({ checked: 5, valid: 1, invalid: 4 });
    expect(summary.byReason).toMatchObject({
      duplicatePosition: 1,
      tooShort: 1,
      illegalMove: 1,
      invalidFen: 1,
    });
    expect(summary.samples.map((s) => s.id)).toEqual([
      'dup',
      'odd',
      'ill',
      'fen',
    ]);
  });

  test('the validate:puzzles script passes over every checked-in fixture CSV', async () => {
    const proc = Bun.spawn(
      [
        process.execPath,
        'run',
        '../chess-puzzle-server/scripts/validate-chess-puzzles.ts',
        ...FIXTURE_CSVS.flatMap((path) => ['--source', path]),
      ],
      { cwd: PACKAGE_ROOT, stdout: 'pipe', stderr: 'pipe' }
    );
    const [stdout, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      proc.exited,
    ]);
    const lastLine = stdout.trim().split('\n').at(-1) ?? '';
    const summary = JSON.parse(lastLine) as {
      checked: number;
      invalid: number;
    };
    expect(summary.invalid).toBe(0);
    expect(summary.checked).toBeGreaterThan(2000);
    expect(exitCode).toBe(0);
  }, 120_000);
});
