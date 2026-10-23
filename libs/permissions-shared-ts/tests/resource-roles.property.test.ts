import { expect, test } from 'bun:test';
import { ROLE } from '@libs/permissions-shared-ts/permission-catalog';
import { resolveResourceRoles } from '@libs/permissions-shared-ts/resource-roles';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('only a nonempty matching actor holds the target-specific puzzle roles', () => {
  assertProperty(
    'resource-specific roles',
    fc.property(
      fc.string(),
      fc.string(),
      fc.string(),
      (actor, author, player) => {
        const roles = resolveResourceRoles(actor, {
          puzzleOwnerId: author,
          puzzlePlayerId: player,
        });
        expect(roles.includes(ROLE.puzzleAuthor)).toBe(
          actor.length > 0 && actor === author
        );
        expect(roles.includes(ROLE.puzzlePlayer)).toBe(
          actor.length > 0 && actor === player
        );
      }
    )
  );
  expect(
    resolveResourceRoles('', { puzzleOwnerId: '', puzzlePlayerId: '' })
  ).toEqual([]);
  expect(resolveResourceRoles('alice', { spacePresence: 'host' })).toEqual([
    ROLE.spaceHost,
  ]);
  expect(
    resolveResourceRoles('alice', {
      spacePresence: 'guest',
      puzzleOwnerId: 'alice',
    })
  ).toEqual([ROLE.spaceMember, ROLE.puzzleAuthor]);
});
