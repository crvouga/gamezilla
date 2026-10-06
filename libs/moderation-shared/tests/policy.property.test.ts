import { describe, expect, test } from 'bun:test';

import { usernameLabel } from '@libs/moderation-shared/display';
import {
  createAppModeration,
  SHIPPED_TEAM_RULES,
} from '@libs/moderation-shared/policy';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const moderation = createAppModeration(SHIPPED_TEAM_RULES);

const USERNAME_ALPHABET = /^[a-zA-Z0-9_]+$/;

const arbText = fc.oneof(
  fc.string({ maxLength: 24 }),
  fc.string({ maxLength: 24, unit: 'grapheme' }),
  fc.constantFrom('sh1thead', 'f.u_c-k', 'admin', 'alice', 'spam.gg')
);

describe('the product policy agrees with itself at every level', () => {
  test('a name refused on write is never shown as written', () => {
    assertProperty(
      'refused username ⇒ shown as an alias',
      fc.property(arbText, fc.uuid(), (name, profileId) => {
        if (moderation.checkWrite('username', name).allowed) return;
        const label = usernameLabel(moderation, name, profileId);
        expect(label).not.toBe(`@${name}`);
        expect(label).not.toMatch(USERNAME_ALPHABET);
      })
    );
  });

  test('a title refused on write is hidden on display', () => {
    assertProperty(
      'refused title ⇒ hidden',
      fc.property(arbText, (title) => {
        if (moderation.checkWrite('spaceTitle', title).allowed) return;
        expect(moderation.display('spaceTitle', title, { id: 's' }).text).toBe(
          null
        );
      })
    );
  });
});
