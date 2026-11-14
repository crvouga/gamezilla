import { expect, test } from 'bun:test';
import { checkedIssueOutput, issueAction } from './ci-failure-issue';

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

test('a red run opens the issue once, comments while it stays red, and a green run closes it', () => {
  expect(issueAction(true, null)).toEqual({ kind: 'create' });
  expect(issueAction(true, '388')).toEqual({ kind: 'comment', issue: '388' });
  expect(issueAction(false, '388')).toEqual({ kind: 'close', issue: '388' });
  expect(issueAction(false, null)).toEqual({ kind: 'none' });
});
