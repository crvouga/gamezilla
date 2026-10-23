import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

import {
  isSpecFile,
  mergeStagedViolations,
  ownershipViolations,
  stagedViolations,
} from './verify-spec-ownership';

describe('spec ownership', () => {
  // regression: spec-ownership-package-audit-docs
  test('spec authors may keep Markdown audit evidence in the owning package docs', () => {
    const commit = {
      sha: 'e0d7afbda3',
      subject: 'spec(games): allow puzzles without opponents',
      files: [
        'specs/games/puzzle-attempt.qnt',
        'specs/games/puzzle-opponent.feature',
        'specs/games/puzzle-refusals.feature',
        'specs/games/puzzle-review.feature',
        'specs/games/puzzle-sound.feature',
        'specs/games/puzzle-sound.qnt',
        'specs/games/solve-flow.feature',
        'specs/games/solve-move-rules.feature',
        'specs/games/solve-show-solution.feature',
        'specs/games/ubiquitous-language.yml',
        'libs/games-shared-ts/docs/PUZZLE_LAYOUT_SPEC_AUDIT.md',
      ],
    };
    expect(ownershipViolations([commit])).toEqual([]);
    expect(stagedViolations(commit.files)).toEqual([]);
    for (const file of [
      'pkgs/turn-game-shared-ts/docs/CONTRACT_AUDIT.md',
      'apps/client-ts/docs/BUILD_AUDIT.md',
    ])
      expect(stagedViolations([...commit.files, file])).toEqual([]);
    for (const file of [
      'libs/games-shared-ts/src/docs/CONTRACT_AUDIT.md',
      'libs/games-shared-ts/docs/runtime.ts',
      'libs/games-shared-ts/docs/CONTRACT_AUDIT.md.ts',
    ])
      expect(stagedViolations([...commit.files, file])).toHaveLength(1);
  });

  test('historical spec commits may include generated step catalogs', () => {
    // regression: spec-ownership-generated-step-catalogs
    const commit = {
      sha: 'fc45ac91e07b3ce9c146d0390efc71099057da7b',
      subject: 'spec: define multiplayer matchmaking',
      files: [
        'specs/README.md',
        'docs/STEPS_CATALOG.md',
        'apps/product-ts/STEPS_CATALOG.md',
        'libs/chess-root-harness-ts/STEPS_CATALOG.md',
        'libs/runtime-harness-ts/STEPS_CATALOG.md',
        'pkgs/matchmaking-root-harness-ts/STEPS_CATALOG.md',
      ],
    };
    expect(ownershipViolations([commit])).toEqual([]);
    expect(stagedViolations(commit.files)).toEqual([]);
    for (const file of [
      'libs/chess-root-harness-ts/README.md',
      'libs/chess-root-harness-ts/STEPS_CATALOG.md.ts',
      'libs/chess-root-harness-ts/src/index.ts',
    ]) {
      expect(
        ownershipViolations([{ ...commit, files: [...commit.files, file] }])
      ).toHaveLength(1);
      expect(stagedViolations([...commit.files, file])).toHaveLength(1);
    }
  });

  test('automatically combined parent specs retain their original ownership', () => {
    // regression: spec-ownership-resolved-merge
    const staged = [
      'specs/README.md',
      'specs/chess/ubiquitous-language.yml',
      'specs/conformance.yaml',
      'libs/chess-root-harness-ts/package.json',
    ];
    expect(mergeStagedViolations(staged, staged, [])).toEqual([]);
    assertProperty(
      'authored spec resolutions remain refused beside code',
      fc.property(fc.constantFrom(...staged.slice(0, 3)), (spec) => {
        expect(mergeStagedViolations(staged, staged, [spec])).toHaveLength(1);
      })
    );
  });

  test('merging committed specs does not count them as newly authored changes', () => {
    // regression: spec-ownership-resolved-merge
    expect(
      mergeStagedViolations(
        [
          'specs/profile/account-deletion.feature',
          'libs/tools-harness-ts/scripts/verify-plan.ts',
        ],
        ['libs/tools-harness-ts/scripts/verify-plan.ts']
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
          'libs/tools-harness-ts/scripts/verify-plan.ts',
          'pkgs/quint-server-ts/src/verify.ts'
        ),
        (spec, implementation) => {
          expect(
            mergeStagedViolations(
              [spec, implementation],
              [spec, implementation]
            )
          ).toHaveLength(1);
          expect(mergeStagedViolations([spec], [spec])).toEqual([]);
        }
      )
    );
  });

  // regression: trunk-sync-incoming-spec-ownership
  test('trunk sync accepts unchanged incoming specs but rejects mixed spec resolutions', () => {
    const staged = [
      'specs/README.md',
      'specs/spaces/space-create.feature',
      'libs/tools-harness-ts/goal/known-bugs/bug-1.json',
    ];
    expect(
      mergeStagedViolations(staged, [
        'libs/tools-harness-ts/goal/known-bugs/bug-1.json',
      ])
    ).toEqual([]);
    expect(
      mergeStagedViolations(staged, [
        'specs/spaces/space-create.feature',
        'libs/tools-harness-ts/goal/known-bugs/bug-1.json',
      ])
    ).toHaveLength(1);
    expect(mergeStagedViolations(staged, ['specs/README.md'])).toEqual([]);
  });

  test('merging never hides spec edits introduced by conflict resolution', () => {
    assertProperty(
      'resolved spec edits retain the ownership guard',
      fc.property(
        fc.constantFrom('specs/README.md', 'specs/spaces/space-create.feature'),
        (spec) => {
          expect(
            mergeStagedViolations(
              [spec, 'libs/tools-harness-ts/goal/known-bugs/bug-1.json'],
              [spec, 'libs/tools-harness-ts/goal/known-bugs/bug-1.json']
            )
          ).toHaveLength(1);
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
                  'docs/SPEC_NOTES.md',
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
    expect(isSpecFile('libs/friends-harness-ts/features/remove.feature')).toBe(
      true
    );
    expect(isSpecFile('specs/spaces/space-hosting.qnt')).toBe(true);
    expect(isSpecFile('pkgs/quint-server-ts/tests/fixtures/door.qnt')).toBe(
      false
    );
    expect(isSpecFile('specs/README.md')).toBe(true);
    expect(isSpecFile('specs/conformance.yaml')).toBe(true);
    expect(isSpecFile('specs/billing/access.dmn')).toBe(true);
    expect(isSpecFile('specs/spaces/spaces.als')).toBe(true);
    expect(isSpecFile('specs/runtime/availability.openslo.yaml')).toBe(true);
    expect(isSpecFile('pkgs/dmn-server-ts/tests/fixtures/access.dmn')).toBe(
      false
    );
    expect(
      isSpecFile('libs/billing-harness-ts/tests/dmn/access.binding.ts')
    ).toBe(false);
    expect(isSpecFile('specs/ubiquitous-language.yml')).toBe(true);
    expect(isSpecFile('specs/billing/ubiquitous-language.yml')).toBe(true);
    expect(isSpecFile('specs/billing/glossary.yaml')).toBe(true);
    expect(isSpecFile('specs/billing/events.qnt')).toBe(true);
    expect(isSpecFile('libs/billing-harness-ts/ubiquitous-language.yml')).toBe(
      false
    );
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
          files: ['specs/friends/friend-remove.feature', 'specs/README.md'],
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
        'libs/friends-harness-ts/src/friends.steps.ts',
      ])
    ).toHaveLength(1);
    expect(stagedViolations(['specs/friends/friend-remove.feature'])).toEqual(
      []
    );
    expect(
      stagedViolations([
        'specs/conformance.yaml',
        'libs/billing-harness-ts/tests/dmn/access.binding.ts',
      ])
    ).toHaveLength(1);
    expect(
      stagedViolations([
        'specs/README.md',
        'specs/billing/access.dmn',
        'specs/README.md',
      ])
    ).toEqual([]);
  });
});
