import { describe, expect, test } from 'bun:test';

import {
  isSpecFile,
  ownershipViolations,
  stagedViolations,
} from './check-spec-ownership';

describe('spec ownership', () => {
  test('recognizes every Gherkin file, wherever it is, every model and every glossary', () => {
    expect(isSpecFile('specs/friends/friend-remove.feature')).toBe(true);
    expect(isSpecFile('libs/friends/features/remove.feature')).toBe(true);
    expect(isSpecFile('specs/spaces/space-hosting.qnt')).toBe(true);
    expect(isSpecFile('pkgs/quint/tests/fixtures/door.qnt')).toBe(false);
    expect(isSpecFile('specs/README.md')).toBe(false);
    expect(isSpecFile('specs/ubiquitous-language.yml')).toBe(true);
    expect(isSpecFile('specs/billing/ubiquitous-language.yml')).toBe(true);
    expect(isSpecFile('specs/billing/events.qnt')).toBe(true);
    expect(isSpecFile('libs/billing/ubiquitous-language.yml')).toBe(false);
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
