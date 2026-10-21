// @io-wall-ok — writes generated stubs under .cache/ and runs each in a child `bun test`.
/**
 * Alerting through the generated stub, end to end: the request fixture
 * measured by a child `bun test`. A healthy counter passes every objective
 * and policy; a counter with an outage a quarter of an hour ago fails the
 * policies that are still burning, with the response in the test's message.
 */

import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readEvidence } from '@pkgs/conformance-server/evidence-store';
import { sloStubFileName, sloStubSource } from '@pkgs/openslo-shared/stubs';

const PACKAGE_DIR = join(import.meta.dir, '..');
const SPEC_URI =
  'pkgs/openslo-server/tests/fixtures/requests-served.openslo.yaml';

function runStub(entryDir: string) {
  const outDir = join(PACKAGE_DIR, '.cache/test-alert-stubs', entryDir);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const stub = join(outDir, sloStubFileName(SPEC_URI));
  const reportDir = join(outDir, 'report');
  writeFileSync(
    stub,
    sloStubSource({
      packageName: '@pkgs/openslo',
      specPath: join(import.meta.dir, 'fixtures/requests-served.openslo.yaml'),
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

const DRIFT = 'alert:requests-are-answered:requests-are-answered-budget-drift';
const FAST = 'alert:requests-are-answered:requests-are-answered-fast-burn';
const SLOW = 'alert:requests-are-answered:requests-are-answered-slow-burn';
const ALERTS = [DRIFT, FAST, SLOW];

// regression: slo-alerts-absent-while-grafana-archived
describe('alerts through the generated stub', () => {
  test('stay quiet for a counter that meets its objective', () => {
    const run = runStub('openslo');
    expect(run.status, run.output).toBe(0);
    const alerts = run.obligations.filter((o) => o.id.startsWith('alert:'));
    expect(alerts.map((o) => [o.id, o.status])).toEqual(
      ALERTS.map((id) => [id, 'pass'])
    );
  }, 30_000);

  test('fail the policies still burning after an outage, with what to do next', () => {
    const run = runStub('openslo-degraded-requests');
    expect(run.status).not.toBe(0);
    const failed = run.obligations
      .filter((o) => o.id.startsWith('alert:') && o.status === 'fail')
      .map((o) => o.id);
    // The fast burn's 5 minute window is clean again, so it stays quiet; the
    // slow burn's 30 minute window and the ticket's 6 hour one still hold the outage.
    expect(failed).toEqual([DRIFT, SLOW]);
    expect(run.output).toContain(
      'PAGE requests-are-answered (requests-are-answered-slow-burn) is firing'
    );
    expect(run.output).toContain('Owner: runtime');
    expect(run.output).toContain('Investigate with: bun obs errors --since 1h');
  }, 30_000);
});
