import { describe, expect, test } from 'bun:test';

import {
  isSpecFile,
  ownershipViolations,
  stagedViolations,
} from './check-spec-ownership';

describe('spec ownership', () => {
  test('recognizes every Gherkin file, wherever it is, and every file under specs/', () => {
    expect(isSpecFile('specs/friends/friend-remove.feature')).toBe(true);
    expect(isSpecFile('libs/friends/features/remove.feature')).toBe(true);
    expect(isSpecFile('specs/spaces/space-hosting.qnt')).toBe(true);
    expect(isSpecFile('pkgs/quint/tests/fixtures/door.qnt')).toBe(false);
    expect(isSpecFile('specs/README.md')).toBe(true);
    expect(isSpecFile('specs/conformance.yaml')).toBe(true);
    expect(isSpecFile('specs/billing/access.dmn')).toBe(true);
    expect(isSpecFile('specs/spaces/spaces.als')).toBe(true);
    expect(isSpecFile('specs/health/api.openslo.yaml')).toBe(true);
    expect(isSpecFile('pkgs/dmn/tests/fixtures/access.dmn')).toBe(false);
    expect(isSpecFile('libs/billing/tests/dmn/access.binding.ts')).toBe(false);
    expect(isSpecFile('specs/ubiquitous-language.yml')).toBe(true);
    expect(isSpecFile('specs/billing/ubiquitous-language.yml')).toBe(true);
    expect(isSpecFile('specs/billing/glossary.yaml')).toBe(true);
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
            'specs/README.md',
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
    expect(
      stagedViolations([
        'specs/conformance.yaml',
        'libs/billing/tests/dmn/access.binding.ts',
      ])
    ).toHaveLength(1);
    expect(
      stagedViolations([
        'specs/README.md',
        'specs/billing/access.dmn',
        'specs/README.md',
        'libs/billing/STEPS_CATALOG.md',
      ])
    ).toEqual([]);
  });
});
