import { expect, test } from 'bun:test';
import { secretsScanRange } from './secrets-scan-range';

const HEAD = 'h'.repeat(40);
const BASE = 'b'.repeat(40);
const MAIN_TIP = 'm'.repeat(40);

function git(mergeBase: string | undefined) {
  const calls: string[] = [];
  const run = (args: readonly string[]) => {
    calls.push(args.join(' '));
    if (args[0] === 'rev-parse') return HEAD;
    return mergeBase;
  };
  return { run, calls };
}

test('a local branch scans the commits it adds over origin/main', () => {
  const { run, calls } = git(BASE);
  expect(secretsScanRange({}, run)).toBe(`${BASE}..${HEAD}`);
  expect(calls).toContain(`merge-base origin/main ${HEAD}`);
});

test('a pull request resolves the same range from the PR shas', () => {
  const { run, calls } = git(BASE);
  const env = { GH_EVENT: 'pull_request', PR_BASE: MAIN_TIP, PR_HEAD: HEAD };
  expect(secretsScanRange(env, run)).toBe(`${BASE}..${HEAD}`);
  expect(calls).toEqual([`merge-base ${MAIN_TIP} ${HEAD}`]);
});

test('a head with no commits of its own scans its tip', () => {
  const { run } = git(HEAD);
  expect(secretsScanRange({ GITHUB_EVENT_NAME: 'push' }, run)).toBe(
    `${HEAD}~1..${HEAD}`
  );
});

test('a missing base ref falls back to the tip', () => {
  const { run } = git(undefined);
  expect(secretsScanRange({}, run)).toBe(`${HEAD}~1..${HEAD}`);
});
