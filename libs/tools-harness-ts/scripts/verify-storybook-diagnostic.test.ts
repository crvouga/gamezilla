import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import {
  failedGroups,
  nightlyGroupNames,
  nightlyGroups,
  tracksNightlyIssue,
} from './verify-nightly-verdict';

type Step = { name?: string; if?: string; run?: string };
const workflow = Bun.YAML.parse(
  readFileSync(
    new URL('../../../.github/workflows/verify-nightly.yml', import.meta.url),
    'utf8'
  )
) as {
  on: { workflow_dispatch: { inputs: Record<string, { default?: unknown }> } };
  jobs: Record<string, { if?: string; 'runs-on'?: string; steps: Step[] }>;
};

test('Ubuntu reference authoring is explicit and followed by an uncached comparison', () => {
  const job = workflow.jobs['verify-nightly-storybook']!;
  expect(job.if).toBe(
    "${{ github.event_name == 'workflow_dispatch' && inputs.group == 'storybook' }}"
  );
  expect(job['runs-on']).toBe('ubuntu-24.04');
  expect(
    workflow.on.workflow_dispatch.inputs['update-storybook-baselines']?.default
  ).toBe(false);
  const author = job.steps.findIndex((step) =>
    step.run?.includes('--update-snapshots')
  );
  expect(author).toBeGreaterThanOrEqual(0);
  expect(job.steps[author]?.if).toBe(
    '${{ inputs.update-storybook-baselines }}'
  );
  expect(
    job.steps.findIndex((step) => step.run === 'bun run storybook:test')
  ).toBeGreaterThan(author);
  expect(
    job.steps.find((step) => step.run === 'bun run storybook:test')?.if
  ).toBe('${{ inputs.update-storybook-baselines }}');
  expect(
    job.steps.find((step) => step.run?.includes('turbo run ci:storybook'))?.if
  ).toBe('${{ !inputs.update-storybook-baselines }}');
  const config = JSON.parse(
    readFileSync(
      new URL('../../../pkgs/ui-root-harness-ts/turbo.json', import.meta.url),
      'utf8'
    )
  ) as { tasks: Record<string, { cache?: boolean }> };
  expect(config.tasks['storybook:test']?.cache).toBe(false);
  const upload = job.steps.find((step) =>
    step.run?.includes('ci-artifacts.ts upload')
  )!;
  expect(upload.if).toBe('always() && !cancelled()');
  expect(upload.run).toContain('verify-nightly-storybook-');
});

test('manual Storybook diagnostics preserve every ordinary nightly gate', () => {
  const ordinary = Object.fromEntries(
    nightlyGroupNames().map((name) => [
      `verify-nightly-${name}`,
      { result: 'success' },
    ])
  );
  const skipped = {
    ...ordinary,
    'verify-nightly-storybook': { result: 'skipped' },
  };
  expect(nightlyGroups(skipped)).toHaveLength(nightlyGroupNames().length);
  expect(failedGroups(nightlyGroups(skipped))).toEqual([]);
  expect(nightlyGroupNames('storybook')).toEqual(['storybook']);
  expect(tracksNightlyIssue('storybook', 'refs/heads/main')).toBe(false);
  for (const result of [undefined, 'skipped', 'failure', 'cancelled']) {
    const needs = {
      ...ordinary,
      'verify-nightly-storybook': result === undefined ? {} : { result },
    };
    expect(failedGroups(nightlyGroups(needs, 'storybook'))).toHaveLength(1);
  }
  expect(
    failedGroups(
      nightlyGroups({
        ...ordinary,
        'verify-nightly-storybook': { result: 'failure' },
      })
    )
  ).toHaveLength(1);
});
