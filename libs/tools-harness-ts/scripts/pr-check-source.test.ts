import { expect, test } from 'bun:test';
import {
  isActiveCodeqlProducer,
  memoizedWorkflowEvents,
} from './pr-check-source';

const sha = '166ac03a5c76aff3beaa84df6b1f9162f7e1f4c1';
const producer = {
  head_sha: sha,
  event: 'dynamic',
  path: 'dynamic/github-code-scanning/codeql',
  status: 'in_progress',
};

test('only the same-head GitHub default-setup producer can defer a neutral CodeQL result', () => {
  expect(isActiveCodeqlProducer(producer, sha)).toBe(true);
  for (const change of [
    { head_sha: 'another-head' },
    { event: 'workflow_dispatch' },
    { path: '.github/workflows/verify-pr.yml' },
    { status: 'completed' },
    { status: 'unknown' },
  ])
    expect(isActiveCodeqlProducer({ ...producer, ...change }, sha)).toBe(false);
});

test('each workflow run event is looked up once across polls', () => {
  const lookups: string[] = [];
  const eventOf = memoizedWorkflowEvents((runId) => {
    lookups.push(runId);
    return runId === '1' ? 'pull_request' : 'workflow_dispatch';
  });
  for (let poll = 0; poll < 3; poll++) {
    expect(eventOf('1')).toBe('pull_request');
    expect(eventOf('2')).toBe('workflow_dispatch');
  }
  expect(lookups).toEqual(['1', '2']);
});
