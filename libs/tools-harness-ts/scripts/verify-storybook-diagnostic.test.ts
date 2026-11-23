import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { STORYBOOK_PARTS } from './turbo-ci-run';
import {
  failedGroups,
  nightlyGroupNames,
  nightlyGroups,
  tracksNightlyIssue,
} from './verify-nightly-verdict';

type Step = {
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  with?: Record<string, unknown>;
};
const workflow = Bun.YAML.parse(
  readFileSync(
    new URL('../../../.github/workflows/verify-nightly.yml', import.meta.url),
    'utf8'
  )
) as {
  on: { workflow_dispatch: { inputs: Record<string, { default?: unknown }> } };
  jobs: Record<string, { if?: string; 'runs-on'?: string; steps: Step[] }>;
};

test("the Storybook diagnostic runs the gate's browser states, or the selected ones, and authors nothing", () => {
  const job = workflow.jobs['verify-nightly-storybook']!;
  expect(job.if).toBe(
    "${{ github.event_name == 'workflow_dispatch' && inputs.group == 'storybook' }}"
  );
  expect(job['runs-on']).toBe('ubuntu-24.04');
  // Stories are not compared against stored pictures, so nothing is authored.
  expect(
    Object.keys(workflow.on.workflow_dispatch.inputs).filter((input) =>
      input.includes('baseline')
    )
  ).toEqual([]);
  expect(
    job.steps.filter((step) => step.run?.includes('--update-snapshots'))
  ).toEqual([]);
  expect(
    job.steps.find((step) =>
      [
        'turbo run',
        ...Array.from(
          { length: STORYBOOK_PARTS },
          (_, part) => ` ci:storybook:${String(part)}`
        ),
      ].every((part) => step.run?.includes(part))
    )?.if
  ).toBe('${{ !inputs.storybook-evidence-run && !inputs.storybook-pattern }}');
  // regression: storybook-diagnostic-ignores-pattern
  const selected = job.steps.find(
    (step) => step.name === 'Check selected Storybook states'
  );
  expect(selected?.if).toBe(
    "${{ !inputs.storybook-evidence-run && inputs.storybook-pattern != '' }}"
  );
  expect(selected?.run).toBe(
    'bun run storybook:test --grep "$STORYBOOK_PATTERN"'
  );
  const config = JSON.parse(
    readFileSync(
      new URL('../../../pkgs/ui-root-harness-ts/turbo.json', import.meta.url),
      'utf8'
    )
  ) as { tasks: Record<string, { cache?: boolean }> };
  expect(config.tasks['storybook:test']?.cache).toBe(false);
  const upload = job.steps.find((step) =>
    step.uses?.startsWith('actions/upload-artifact@')
  )!;
  expect(upload.if).toBe(
    '${{ always() && !cancelled() && !inputs.storybook-evidence-run }}'
  );
  expect(String(upload.with?.['name'])).toContain('verify-nightly-storybook-');
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
