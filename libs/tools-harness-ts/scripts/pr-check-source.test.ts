import { expect, test } from 'bun:test';
import { isActiveCodeqlProducer } from './pr-check-source';

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
