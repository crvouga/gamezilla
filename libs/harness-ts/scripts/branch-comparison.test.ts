import { expect, test } from 'bun:test';
import { branchComparison } from './branch-comparison';

// regression: health-cleanup-terminated-comparison
test('a terminated comparison fails maintenance without integration proof', () => {
  expect(() =>
    branchComparison({ status: null, stdout: '', stderr: 'terminated' })
  ).toThrow('GitHub maintenance failed: terminated');
});

// regression: health-cleanup-unrelated-history
test('orphan history is retained without aborting the maintenance inventory', () => {
  expect(
    branchComparison({
      status: 1,
      stdout: '',
      stderr:
        'gh: No common ancestor between main and 9cf78c38eafca8501bf779973a97d9b3e01501189. (HTTP 404)',
    })
  ).toBe('unrelated');
});

test('missing refs and authentication failures still fail maintenance', () => {
  for (const stderr of [
    'gh: Not Found (HTTP 404)',
    'gh: Bad credentials (HTTP 401)',
  ])
    expect(() => branchComparison({ status: 1, stdout: '', stderr })).toThrow(
      'GitHub maintenance failed'
    );
});

test('successful comparisons retain their integration verdict', () => {
  for (const status of ['behind', 'identical', 'ahead', 'diverged'])
    expect(
      branchComparison({
        status: 0,
        stdout: JSON.stringify({ status }),
        stderr: '',
      })
    ).toBe(status);
});
