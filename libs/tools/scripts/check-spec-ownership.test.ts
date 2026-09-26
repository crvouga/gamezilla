import { describe, expect, test } from 'bun:test';

import {
  isFeatureFile,
  ownershipViolations,
  stagedViolations,
} from './check-spec-ownership';

describe('spec ownership', () => {
  test('recognizes only Gherkin files below a features directory', () => {
    expect(isFeatureFile('libs/friends/features/remove.feature')).toBe(true);
    expect(isFeatureFile('features/nested/remove.feature')).toBe(true);
    expect(isFeatureFile('libs/friends/features/README.md')).toBe(false);
  });

  test('requires feature-only spec commits', () => {
    expect(
      ownershipViolations([
        {
          files: ['libs/friends/features/remove.feature'],
          sha: '1234567890abcdef',
          subject: 'feat: remove friends',
        },
      ])
    ).toHaveLength(1);
    expect(
      ownershipViolations([
        {
          files: [
            'libs/friends/features/remove.feature',
            'libs/friends/STEPS_CATALOG.md',
            'docs/SPEC_DRIVEN_DEVELOPMENT.md',
          ],
          sha: '1234567890abcdef',
          subject: 'spec(friends): remove friends',
        },
      ])
    ).toEqual([]);
  });

  test('rejects a staged mixture of feature and implementation files', () => {
    expect(
      stagedViolations([
        'libs/friends/features/remove.feature',
        'libs/friends/tests/steps/friends.steps.ts',
      ])
    ).toHaveLength(1);
    expect(stagedViolations(['libs/friends/features/remove.feature'])).toEqual(
      []
    );
  });
});
