import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ciStageTasks } from './ci-stage';
import { MAIN_VERIFY_TASKS } from './turbo-ci-run';

test('nightly and local verification retain the complete catalog', () => {
  expect(ciStageTasks(MAIN_VERIFY_TASKS, 'nightly')).toEqual(MAIN_VERIFY_TASKS);
  expect(ciStageTasks(MAIN_VERIFY_TASKS, undefined)).toEqual(MAIN_VERIFY_TASKS);
});

test('blocking stages preserve irreversible-change and security safeguards', () => {
  for (const stage of ['pr', 'release']) {
    const tasks = ciStageTasks(MAIN_VERIFY_TASKS, stage);
    for (const task of [
      'tc',
      'lint',
      '@libs/tools-harness-ts#verify:secrets',
      '@libs/tools-harness-ts#verify:workflow-security',
      '@libs/runtime-server-ts#verify:schema-evolution',
      '@apps/product-ts#verify:worker-bundle',
      '@apps/synthetic-population-worker-ts#verify:synthetic-population-foundation',
    ])
      expect(tasks).toContain(task);
    for (const task of [
      'test',
      'verify:models',
      'test:spec:0',
      'test:contract:0',
    ])
      expect(tasks).not.toContain(task);
    expect(tasks).toContain('@libs/permissions-harness-ts#test');
  }
});

test('a misspelled stage cannot silently remove verification', () => {
  expect(() => ciStageTasks(MAIN_VERIFY_TASKS, 'relese')).toThrow(
    'Unknown CI stage'
  );
});

// regression: release-schema-compared-to-itself
test('Release compares schema evolution against the pre-push commit', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/workflows/verify-pr.yml'),
      'utf8'
    )
  ) as { env: Record<string, string> };
  expect(workflow.env['PR_BASE']).toBe(
    "${{ github.event.pull_request.base.sha || github.event.before || format('{0}^', github.sha) }}"
  );
});

test('PR and release use the same safety tasks, with no lost nightly coverage', () => {
  const pr = ciStageTasks(MAIN_VERIFY_TASKS, 'pr');
  expect(pr).toEqual(ciStageTasks(MAIN_VERIFY_TASKS, 'release'));
  expect(new Set(pr).size).toBe(pr.length);
  for (const task of pr)
    expect(
      MAIN_VERIFY_TASKS.includes(task) ||
        (task.endsWith('#test') && MAIN_VERIFY_TASKS.includes('test'))
    ).toBe(true);
  for (const task of [
    '@pkgs/db-migrate-shared-ts#test',
    '@pkgs/db-schema-root-shared-ts#test',
    '@pkgs/permissions-shared-ts#test',
  ])
    expect(pr).toContain(task);
});
