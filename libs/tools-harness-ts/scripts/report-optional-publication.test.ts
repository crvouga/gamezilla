// @io-wall-ok — invoke the publication CLIs against an unconfigured environment.
import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { publishConfiguredReports } from '@libs/harness-ts/report-store-configuration';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { prepareReports } from './verify-report-lifecycle';

const ROOT = join(import.meta.dirname, '../../..');

function publication(script: string, configured: boolean) {
  const env: NodeJS.ProcessEnv = { ...process.env, GITHUB_ACTIONS: 'true' };
  for (const key of [
    'REPORTS_BUCKET',
    'REPORTS_ENDPOINT',
    'REPORTS_WRITE_ACCESS_KEY_ID',
    'REPORTS_WRITE_SECRET_ACCESS_KEY',
  ])
    delete env[key];
  if (configured) env['REPORTS_BUCKET'] = 'reports';
  return Bun.spawnSync([process.execPath, 'run', script, 'prepare'], {
    cwd: ROOT,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

// regression: retired-reports-nightly-publication
test.each([
  'libs/harness-ts/scripts/report-publish.ts',
  'libs/tools-harness-ts/scripts/verify-reports.ts',
])(
  '%s skips optional publication in CI before any transfer when the store is absent',
  (script) => {
    const result = publication(script, false);
    expect(result.exitCode).toBe(0);
    expect(result.stdout.toString()).toContain(
      'optional reports store is unconfigured; nothing published'
    );
  }
);

test('the publication CLI still fails with incomplete credentials in CI', () => {
  const result = publication('libs/harness-ts/scripts/report-publish.ts', true);
  expect(result.exitCode).not.toBe(0);
  expect(result.stderr.toString()).toContain('REPORTS_ENDPOINT is not set');
});

// regression: retired-reports-nightly-publication
test('the task runner needs no restore plan when report publication is unconfigured', async () => {
  const env: NodeJS.ProcessEnv = { GITHUB_ACTIONS: 'true' };
  expect(
    await prepareReports({ tasks: [], toExecute: [], remoteHits: [] }, env)
  ).toEqual([]);
  expect(env['VERIFY_REPORT_PLAN_PATH']).toBeUndefined();
});

test('optional publication depends only on report credentials, not the runner', async () => {
  await assertProperty(
    'optional report store configuration',
    fc.asyncProperty(
      fc.boolean(),
      fc.array(fc.boolean(), { minLength: 4, maxLength: 4 }),
      async (ci, configured) => {
        const env: NodeJS.ProcessEnv = { GITHUB_ACTIONS: String(ci) };
        [
          'REPORTS_BUCKET',
          'REPORTS_ENDPOINT',
          'REPORTS_WRITE_ACCESS_KEY_ID',
          'REPORTS_WRITE_SECRET_ACCESS_KEY',
        ].forEach((key, index) => {
          if (configured[index]) env[key] = 'configured';
        });
        let attempted = false;
        const result = await publishConfiguredReports(env, async () => {
          attempted = true;
        });
        expect(attempted).toBe(configured.some(Boolean));
        expect(result).toBe(attempted);
      }
    )
  );
});
