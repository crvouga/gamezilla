import { describe, expect, test } from 'bun:test';

import type { AvatarConfig } from '@libs/profile-shared/avatar-config';
import { AvatarSeedGenerator, configsEqual, createDefaultAvatarConfig, DEFAULT_AVATAR_STYLE, parseAvatarConfig, resolveAvatarSeed, serializeAvatarConfig, serializeDefaultAvatarConfig } from '@libs/profile-shared/avatar-config';
import { arbJsonObject, arbJsonValue } from '@pkgs/property-shared/json';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

const arbConfig: fc.Arbitrary<AvatarConfig> = fc.record({
  style: fc.oneof(
    fc.constantFrom(DEFAULT_AVATAR_STYLE, 'lorelei', 'pixelArt'),
    fc.string({ minLength: 1, maxLength: 12 })
  ),
  seed: fc.string({ maxLength: 16 }),
  options: arbJsonObject(),
});

/** Same JSON value with every object's keys re-inserted in another order. */
function shuffleKeys(value: unknown, order: readonly number[]): unknown {
  if (Array.isArray(value)) return value.map((v) => shuffleKeys(v, order));
  if (value === null || typeof value !== 'object') return value;
  const entries = Object.entries(value);
  const shuffled = entries
    .map((entry, i) => ({ entry, rank: order[i % order.length] ?? 0 }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ entry: [k, v] }) => [k, shuffleKeys(v, order)] as const);
  return Object.fromEntries(shuffled);
}

describe('avatar config wire form', () => {
  test('serialize then parse round-trips (string and parsed-object forms)', () => {
    assertProperty(
      'parse . serialize = id',
      fc.property(arbConfig, (config) => {
        const wire = serializeAvatarConfig(config);
        const fromString = parseAvatarConfig(wire);
        expect(fromString).not.toBeNull();
        expect(configsEqual(fromString as AvatarConfig, config)).toBe(true);
        expect(parseAvatarConfig(JSON.parse(wire))).toEqual(fromString);
        expect(serializeAvatarConfig(fromString as AvatarConfig)).toBe(wire);
      })
    );
  });

  test('serialization is canonical: key order never matters', () => {
    assertProperty(
      'serialize invariant under key order',
      fc.property(
        arbConfig,
        fc.array(fc.nat({ max: 50 }), { minLength: 1, maxLength: 8 }),
        (config, order) => {
          const reordered = {
            ...config,
            options: shuffleKeys(config.options, order) as Record<
              string,
              unknown
            >,
          };
          expect(serializeAvatarConfig(reordered)).toBe(
            serializeAvatarConfig(config)
          );
          expect(configsEqual(reordered, config)).toBe(true);
        }
      )
    );
  });

  test('parse is total and idempotent over arbitrary input', () => {
    assertProperty(
      'parse idempotent',
      fc.property(fc.oneof(arbJsonValue(), fc.string(), arbConfig), (raw) => {
        const once = parseAvatarConfig(raw);
        if (once === null) return;
        expect(once.style.length).toBeGreaterThan(0);
        expect(parseAvatarConfig(once)).toEqual(once);
        expect(parseAvatarConfig(serializeAvatarConfig(once))).toEqual(
          parseAvatarConfig(JSON.parse(serializeAvatarConfig(once)))
        );
      })
    );
  });

  test('the default config is seeded by the profile id', () => {
    assertProperty(
      'default config',
      fc.property(fc.string({ minLength: 1 }), (profileId) => {
        const config = createDefaultAvatarConfig(profileId);
        expect(config).toEqual({
          style: DEFAULT_AVATAR_STYLE,
          seed: profileId,
          options: {},
        });
        expect(resolveAvatarSeed(config, 'fallback')).toBe(
          profileId.trim().length > 0 ? profileId.trim() : 'fallback'
        );
        expect(
          parseAvatarConfig(serializeDefaultAvatarConfig(profileId))
        ).toEqual(config);
      })
    );
  });
});

describe('AvatarSeedGenerator', () => {
  test('draws length characters from [a-z0-9] for any random source in [0, 1)', () => {
    assertProperty(
      'seed shape',
      fc.property(
        fc.array(
          fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }),
          {
            minLength: 1,
            maxLength: 16,
          }
        ),
        fc.nat({ max: 24 }),
        (draws, length) => {
          let i = 0;
          const seed = new AvatarSeedGenerator(
            () => draws[i++ % draws.length] ?? 0
          ).generate(length);
          expect(seed).toMatch(new RegExp(`^[a-z0-9]{${length}}$`));
        }
      )
    );
  });
});
