import { describe, expect, test } from 'bun:test';

import {
  isFeatureFile,
  ownershipViolations,
  stagedViolations,
} from './check-spec-ownership';

describe('spec ownership', () => {
  test('recognizes every Gherkin file, wherever it is', () => {
    expect(isFeatureFile('specs/friends/friend-remove.feature')).toBe(true);
    expect(isFeatureFile('libs/friends/features/remove.feature')).toBe(true);
    expect(isFeatureFile('specs/README.md')).toBe(false);
  });

  test('requires feature-only spec commits', () => {
    expect(
      ownershipViolations([
        {
          files: ['specs/friends/friend-remove.feature'],
          sha: '1234567890abcdef',
          subject: 'feat: remove friends',
        },
      ])
    ).toHaveLength(1);
    expect(
      ownershipViolations([
        {
          files: [
            'specs/friends/friend-remove.feature',
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
        'specs/friends/friend-remove.feature',
        'libs/friends/tests/steps/friends.steps.ts',
      ])
    ).toHaveLength(1);
    expect(stagedViolations(['specs/friends/friend-remove.feature'])).toEqual(
      []
    );
  });
});
