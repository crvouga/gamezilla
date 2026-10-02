import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/property';

import {
  isSpecFile,
  ownershipViolations,
  stagedViolations,
} from './check-spec-ownership';

describe('spec ownership', () => {
  test('merging committed specs does not count them as newly authored changes', () => {
    // regression: spec-ownership-resolved-merge
    expect(
      stagedViolations(
        [
          'specs/profile/account-deletion.feature',
          'libs/tools/scripts/check-plan.ts',
        ],
        ['libs/tools/scripts/check-plan.ts']
      )
    ).toEqual([]);
  });

  test('merge resolutions still reject newly changed specs mixed with code', () => {
    assertProperty(
      'merge resolutions preserve spec ownership',
      fc.property(
        fc.constantFrom(
          'specs/README.md',
          'specs/profile/account-deletion.feature'
        ),
        fc.constantFrom(
          'libs/tools/scripts/check-plan.ts',
          'pkgs/quint/src/verify.ts'
        ),
        (spec, implementation) => {
          expect(
            stagedViolations([spec, implementation], [spec, implementation])
          ).toHaveLength(1);
          expect(stagedViolations([spec], [spec])).toEqual([]);
        }
      )
    );
  });

  test('rulebook changes require spec subjects even when labeled documentation', () => {
    // regression: spec-rulebook-commit-subject
    expect(
      ownershipViolations([
        {
          sha: '5b99004138',
          subject: 'docs(specs): define canonical spec locations',
          files: ['specs/README.md'],
        },
      ])
    ).toHaveLength(1);
  });

  // regression: conventional-spec-commit-rejected
  test('recognizes the Conventional Commit used for database safety contracts', () => {
    expect(
      ownershipViolations([
        {
          sha: '3ad37c5344',
          subject: 'docs(specs): add database safety contracts',
          files: ['specs/db-schema/server-reconciliation.feature'],
        },
      ])
    ).toEqual([]);
  });

  test('both spec commit forms require specs and forbid implementation files', () => {
    assertProperty(
      'spec commit ownership remains isolated',
      fc.property(
        fc.constantFrom('spec:', 'spec(db):', 'docs(specs):', 'docs(specs)!:'),
        fc.constantFrom('libs/db/src/index.ts', 'pkgs/db-schema/package.json'),
        (prefix, implementation) => {
          const commit = {
            sha: '1234567890',
            subject: `${prefix} add safety contracts`,
          };
          expect(
            ownershipViolations([{ ...commit, files: [implementation] }])
          ).toHaveLength(1);
          expect(
            ownershipViolations([
              {
                ...commit,
                files: [
                  'specs/db-schema/server-reconciliation.feature',
                  implementation,
                ],
              },
            ])
          ).toHaveLength(1);
          expect(
            ownershipViolations([
              {
                ...commit,
                files: [
                  'specs/db-schema/server-reconciliation.feature',
                  'docs/STEPS_CATALOG.md',
                ],
              },
            ])
          ).toEqual([]);
        }
      )
    );
  });

  test('ordinary docs commits cannot change specs', () => {
    for (const subject of [
      'docs: add contracts',
      'docs(db): add contracts',
      'docs(specs-extra): add contracts',
    ]) {
      expect(
        ownershipViolations([
          {
            sha: '1234567890',
            subject,
            files: ['specs/db-schema/server-reconciliation.feature'],
          },
        ])
      ).toHaveLength(1);
    }
  });

  test('recognizes every Gherkin file, wherever it is, and every file under specs/', () => {
    expect(isSpecFile('specs/friends/friend-remove.feature')).toBe(true);
    expect(isSpecFile('libs/friends/features/remove.feature')).toBe(true);
    expect(isSpecFile('specs/spaces/space-hosting.qnt')).toBe(true);
    expect(isSpecFile('pkgs/quint/tests/fixtures/door.qnt')).toBe(false);
    expect(isSpecFile('specs/README.md')).toBe(true);
    expect(isSpecFile('specs/conformance.yaml')).toBe(true);
    expect(isSpecFile('specs/billing/access.dmn')).toBe(true);
    expect(isSpecFile('specs/spaces/spaces.als')).toBe(true);
    expect(isSpecFile('specs/runtime/availability.openslo.yaml')).toBe(true);
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
