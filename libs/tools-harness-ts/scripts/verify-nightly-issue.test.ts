import { expect, test } from 'bun:test';
import {
  checkedIssueOutput,
  issueAction,
  withRedHistory,
} from './ci-failure-issue';

// regression: nightly-issue-reporting-silent-failure
test('an issue API permission failure cannot be interpreted as an empty issue list', () => {
  expect(() =>
    checkedIssueOutput({
      status: 1,
      stdout: '',
      stderr: 'HTTP 403: Resource not accessible by integration',
    })
  ).toThrow('HTTP 403');
  expect(() =>
    checkedIssueOutput({ status: null, stdout: null, stderr: null })
  ).toThrow();
  expect(checkedIssueOutput({ status: 0, stdout: '', stderr: '' })).toBe('');
  expect(checkedIssueOutput({ status: 0, stdout: '258\n', stderr: '' })).toBe(
    '258'
  );
});

test('a red run opens the issue once, rewrites it while it stays red, and a green run closes it', () => {
  expect(issueAction(true, [])).toEqual({ kind: 'create' });
  expect(issueAction(true, ['388'])).toEqual({ kind: 'update', issue: '388' });
  expect(issueAction(false, ['388'])).toEqual({
    kind: 'close',
    issues: ['388'],
  });
  expect(issueAction(false, [])).toEqual({ kind: 'none' });
});

// regression: duplicate-nightly-issue-survives-green
test('a green nightly resolves both reports for the same incident', () => {
  const reports = ['475', '388'];
  expect(issueAction(true, reports)).toEqual({ kind: 'update', issue: '475' });
  expect(issueAction(false, reports)).toEqual({
    kind: 'close',
    issues: reports,
  });
});

test('an issue keeps the run that first went red and counts each later red run once', () => {
  const first = withRedHistory('## ❌ Release', null, 'https://x/runs/1');
  expect(first).toContain(
    'Red since https://x/runs/1. Red runs since then: 1.'
  );
  const second = withRedHistory('## ❌ Release', first, 'https://x/runs/2');
  expect(second).toContain(
    'Red since https://x/runs/1. Red runs since then: 2.'
  );
  // A re-run job reports the same run again.
  expect(withRedHistory('## ❌ Release', second, 'https://x/runs/2')).toBe(
    second
  );
  // The newest report replaces the last one; history is not stacked.
  expect(second.match(/Red since/g)).toHaveLength(1);
});
