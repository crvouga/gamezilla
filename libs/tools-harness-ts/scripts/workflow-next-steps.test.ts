import { expect, test } from 'bun:test';
import { nextStepsMarkdown } from './workflow-next-steps';

const run = {
  repo: 'o/r',
  runId: '42',
  server: 'https://github.com',
  secretsEnv: 'dev',
};

test('a failed run summary ends with the commands that reach its failure', () => {
  const lines = nextStepsMarkdown(run).split('\n');
  expect(lines).toContain(
    `gh run view 42 --repo o/r --json jobs --jq '.jobs[] | select(.conclusion == "failure") | {name, url}'`
  );
  expect(lines).toContain('gh run view 42 --repo o/r --log-failed | tail -200');
  expect(
    lines.some((line) =>
      line.includes('--run 42 download-all critical-journeys-')
    )
  ).toBe(true);
  expect(lines).toContain(
    'Playbook: https://github.com/o/r/blob/main/.agents/skills/ci-workflows-green/SKILL.md'
  );
});

test('journey evidence is offered only for a job that ran against an environment', () => {
  expect(nextStepsMarkdown({ ...run, secretsEnv: '' })).not.toContain(
    'critical-journeys-'
  );
  expect(nextStepsMarkdown({ ...run, runId: '' })).toBe('');
});
