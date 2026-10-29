// @io-wall-ok — writes generated stubs under .cache/ and runs each in a child `bun test`.
/**
 * The generated stub, end to end: written as the spec runner writes it, run
 * by a child `bun test`. Against the healthy product it passes; against the
 * product with an error burst it fails and records the broken objectives.
 */

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { sloStubFileName, sloStubSource } from '@pkgs/openslo-shared-ts/stubs';

const PACKAGE_DIR = join(import.meta.dir, '..');
const SPEC_URI =
  'pkgs/openslo-server-ts/tests/fixtures/note-delivery.openslo.yaml';

describe('stub names', () => {
  test.each([
    [
      'specs/sync-engine/note-delivery.openslo.yaml',
      'sync-engine-note-delivery.openslo.test.ts',
    ],
    ['specs/billing/checkout.openslo.yml', 'billing-checkout.openslo.test.ts'],
  ])('%s', (uri, name) => {
    expect(sloStubFileName(uri)).toBe(name);
  });
});

function runStub(entryDir: string): {
  readonly status: number | null;
  readonly output: string;
  readonly obligations: readonly {
    readonly id: string;
    readonly status: string;
  }[];
} {
  const outDir = join(PACKAGE_DIR, '.cache/test-stubs', entryDir);
  removeTree(outDir, { whenLocked: 'leave' });
  mkdirSync(outDir, { recursive: true });
  const stub = join(
    outDir,
    sloStubFileName('specs/sync-engine/note-delivery.openslo.yaml')
  );
  const reportDir = join(outDir, 'report');
  writeFileSync(
    stub,
    sloStubSource({
      packageName: '@pkgs/openslo',
      specPath: join(import.meta.dir, 'fixtures/note-delivery.openslo.yaml'),
      specUri: SPEC_URI,
      entry: join(import.meta.dir, entryDir, 'index.ts'),
      bridge: join(PACKAGE_DIR, 'src/bun-test.ts'),
      reportDir,
    })
  );
  const run = spawnSync(process.execPath, ['test', stub], {
    cwd: PACKAGE_DIR,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  const [evidence] = readEvidence(reportDir).records;
  if (evidence === undefined)
    throw new Error(`no evidence recorded\n${run.stdout}${run.stderr}`);
  return {
    status: run.status,
    output: `${run.stdout}${run.stderr}`,
    obligations: evidence.obligations,
  };
}

describe('the generated stub', () => {
  test('passes against a product that meets its objectives', () => {
    const run = runStub('openslo');
    expect(run.status, run.output).toBe(0);
    expect(run.obligations.every((o) => o.status === 'pass')).toBe(true);
  }, 30_000);

  test('fails against a product with an error burst, naming the broken objectives', () => {
    const run = runStub('openslo-degraded');
    expect(run.status).not.toBe(0);
    expect(run.output).toContain(
      'note-delivery-success does not meet "99% of notes delivered"'
    );
    expect(
      run.obligations.filter((o) => o.status === 'fail').map((o) => o.id)
    ).toEqual([
      'objective:note-delivery-hourly:every hour this week delivers',
      'objective:note-delivery-success:99% of notes delivered',
    ]);
  }, 30_000);
});
