import { expect, test } from 'bun:test';
import { checkedIssueOutput } from './verify-nightly-verdict';

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
