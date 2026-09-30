import { describe, expect, test } from 'bun:test';
import { decouplingProblems } from './spec-decoupling';

function problems(path: string, text: string): readonly string[] {
  return decouplingProblems([{ path, text }]);
}

describe('decouplingProblems (D1)', () => {
  test('product words, traceability tags, usernames and Quint imports are clean', () => {
    expect(
      problems(
        'specs/friends/friend-remove.feature',
        [
          '@domain:friends',
          'Feature: Removing a friend',
          '  @regression:friend-request-offline-queued',
          '  Scenario: Alice removes Bob',
          "    Given Alice's username is @alice_guest",
          '    When Alice removes Bob, e.g. from 3.7.5.1 of the rules',
          '    Then Bob is no longer on the friends list',
        ].join('\n')
      )
    ).toEqual([]);
    expect(
      problems(
        'specs/friends/friendship.qnt',
        'import events.* from "./events"\nimport spaces.* from "../spaces/events"'
      )
    ).toEqual([]);
  });

  test('a host or runner tag is reported, on the feature or a scenario', () => {
    const errors = problems(
      'specs/billing/payments.feature',
      '@domain:billing @production\nFeature: Payments\n  @oauth-relay\n  Scenario: x'
    ).join('\n');
    expect(errors).toContain('payments.feature:1: D1 tag @production');
    expect(errors).toContain('payments.feature:3: D1 tag @oauth-relay');
    expect(errors).not.toContain('@domain:billing');
  });

  test('@synthetic is an exact tag', () => {
    expect(
      problems(
        'specs/billing/payments.feature',
        '@domain:billing @synthetic\nFeature: Payments\n  Scenario: x'
      )
    ).toEqual([]);
    const errors = problems(
      'specs/billing/payments.feature',
      '@domain:billing @synthetic-production\nFeature: Payments\n  Scenario: x'
    ).join('\n');
    expect(errors).toContain('D1 tag @synthetic-production');
    expect(errors).not.toContain('D1 tag @synthetic ');
  });

  test('tags are only read from tag lines, and not in Quint or glossaries', () => {
    expect(
      problems('specs/a/b.qnt', '  /// @browser is not a Quint tag')
    ).toEqual([]);
  });

  test('a file path in a Quint comment is reported once', () => {
    const errors = problems(
      'specs/sync-engine/note-replication.qnt',
      '// sees after a quiet moment. The binding is\n// `pkgs/sync-engine/tests/quint/note-replication.binding.ts`.'
    );
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain(
      'note-replication.qnt:2: D1 names a repo directory'
    );
  });

  test('workspace packages, doc paths and source file names are reported', () => {
    const errors = problems(
      'specs/room/ubiquitous-language.yml',
      [
        '# bound in @pkgs/room-harness',
        '# see specs/README.md',
        '# the kernel is ubiquitous-language.yml',
        '# written in room.steps.ts',
      ].join('\n')
    ).join('\n');
    expect(errors).toContain(
      ':1: D1 names a workspace package "@pkgs/room-harness"'
    );
    expect(errors).toContain(':2: D1 names a repo directory "specs/README.md"');
    expect(errors).toContain(
      ':3: D1 names a source file "ubiquitous-language.yml"'
    );
    expect(errors).toContain(':4: D1 names a source file "room.steps.ts"');
  });

  test('every spec kind and the manifest are held to D1; the rulebook is not', () => {
    for (const path of [
      'specs/billing/access.dmn',
      'specs/spaces/spaces.als',
      'specs/runtime/availability.openslo.yaml',
      'specs/conformance.yaml',
    ]) {
      expect(problems(path, '# bound in libs/billing/tests/dmn')).toHaveLength(
        1
      );
    }
    expect(
      problems('specs/billing/refunds.qnt', '// see access.dmn and spaces.als')
    ).toHaveLength(2);
    expect(
      problems(
        'specs/README.md',
        'specs/<context>/<table>.dmn is bound in tests/dmn/ of @libs/billing'
      )
    ).toEqual([]);
  });
});
