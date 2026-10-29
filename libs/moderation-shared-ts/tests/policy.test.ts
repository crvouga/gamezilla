import { describe, expect, test } from 'bun:test';

import { moderationAlias } from '@libs/moderation-shared-ts/alias';
import {
  spaceTitleText,
  usernameLabel,
} from '@libs/moderation-shared-ts/display';
import {
  createAppModeration,
  SHIPPED_TEAM_RULES,
} from '@libs/moderation-shared-ts/policy';
import { isReservedName } from '@libs/moderation-shared-ts/reserved-name-check';
import {
  NAMESPACE,
  PRODUCT,
} from '@libs/product-identity-shared-ts/product-identity';

const moderation = createAppModeration(SHIPPED_TEAM_RULES);

describe('username policy', () => {
  test('refuses profanity, disguised or not, from either word list', () => {
    for (const name of ['sh1thead_99', 'f_u_c_k', 'BigBitch', 'fuuuck']) {
      expect(moderation.checkWrite('username', name).allowed).toBe(false);
    }
  });

  test('refuses names that pass someone off as the team', () => {
    for (const name of [
      'admin',
      `${PRODUCT.brand.shortName}_Official`,
      'm0derator7',
      'Support',
    ]) {
      expect(isReservedName(name)).toBe(true);
      expect(moderation.checkWrite('username', name).allowed).toBe(false);
    }
    for (const name of ['badminton', 'supporter', 'modest_mouse', 'alice']) {
      expect(isReservedName(name)).toBe(false);
    }
  });

  test('refuses the product’s own names in every spelling it has had', () => {
    for (const productName of [
      PRODUCT.brand.name,
      PRODUCT.brand.shortName,
      NAMESPACE,
      ...PRODUCT.aliases,
    ]) {
      for (const name of [
        productName,
        productName.toUpperCase(),
        `the_${productName.replaceAll(' ', '_')}7`,
      ]) {
        expect(isReservedName(name)).toBe(true);
        expect(moderation.checkWrite('username', name).allowed).toBe(false);
      }
    }
  });

  test('accepts ordinary names', () => {
    for (const name of [
      'alice_one',
      'BraveTiger482',
      'chess_fan_7',
      'scunthorpe_fan',
    ]) {
      expect(moderation.checkWrite('username', name)).toEqual({
        allowed: true,
      });
    }
  });

  test('a stored refused name is shown as a stable alias, never as a handle', () => {
    const label = usernameLabel(moderation, 'sh1thead_99', 'profile-1');
    expect(label).toBe(moderationAlias('profile-1'));
    expect(label).toBe(usernameLabel(moderation, 'sh1thead_99', 'profile-1'));
    expect(label).toContain(' ');
    expect(label.startsWith('@')).toBe(false);
    expect(usernameLabel(moderation, 'alice_one', 'profile-1')).toBe(
      '@alice_one'
    );
    expect(usernameLabel(moderation, '', 'profile-1')).toBe('');
  });

  test('aliases are themselves clean and never a valid username', () => {
    for (let i = 0; i < 200; i += 1) {
      const alias = moderationAlias(`p${String(i)}`);
      expect(alias).not.toMatch(/^[a-zA-Z0-9_]+$/);
      expect(moderation.inspect('username', alias.replace(/ /g, ''))).toEqual(
        []
      );
    }
  });
});

describe('space title policy', () => {
  test('refuses links, hidden characters and profanity', () => {
    for (const title of [
      'free coins at spam.gg',
      'https://x.example',
      'nice‮txet',
      'shit show',
    ]) {
      expect(moderation.checkWrite('spaceTitle', title).allowed).toBe(false);
    }
  });

  test('accepts ordinary titles', () => {
    for (const title of [
      'Friday puzzles',
      'Assassin chess club',
      'Café 2.0',
      'Scunthorpe chess club',
    ]) {
      expect(moderation.checkWrite('spaceTitle', title).allowed).toBe(true);
    }
  });

  test('a stored refused title is hidden so the default title shows', () => {
    expect(spaceTitleText(moderation, 'shit show', 's1')).toBeNull();
    expect(spaceTitleText(moderation, 'Friday puzzles', 's1')).toBe(
      'Friday puzzles'
    );
    expect(spaceTitleText(moderation, null, 's1')).toBeNull();
    expect(spaceTitleText(moderation, '', 's1')).toBeNull();
  });
});
