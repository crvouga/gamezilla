import { describe, expect, test } from 'bun:test';
import {
  createAppModeration,
  SHIPPED_TEAM_RULES,
} from '@libs/moderation-shared-ts/policy';
import {
  canChangeUsername,
  normalizeUsername,
  USERNAME_CHANGE_COOLDOWN_MS,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  validateUsername,
} from '@libs/profile-shared-ts/username';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const moderation = createAppModeration(SHIPPED_TEAM_RULES);

const ALPHABET = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_',
];

/** Strings over the username alphabet, lengths straddling both bounds. */
const arbWellFormed = fc
  .array(fc.constantFrom(...ALPHABET), { maxLength: USERNAME_MAX_LENGTH + 4 })
  .map((chars) => chars.join(''));

const arbPadding = fc
  .array(fc.constantFrom(' ', '\t', '\n', ' '), { maxLength: 3 })
  .map((chars) => chars.join(''));

const arbRaw = fc.oneof(
  arbWellFormed,
  fc.tuple(arbPadding, arbWellFormed, arbPadding).map((p) => p.join('')),
  fc.string({ maxLength: 40 }),
  fc.string({ maxLength: 40, unit: 'grapheme' })
);

function isInAlphabet(s: string): boolean {
  return [...s].every((c) => ALPHABET.includes(c));
}

describe('validateUsername', () => {
  test('validates the normalized form, and normalizing is idempotent', () => {
    assertProperty(
      'validate . normalize = validate',
      fc.property(arbRaw, arbPadding, arbPadding, (raw, pre, post) => {
        const once = normalizeUsername(raw);
        expect(normalizeUsername(once)).toBe(once);
        expect(validateUsername(once, moderation)).toBe(
          validateUsername(raw, moderation)
        );
        expect(validateUsername(`${pre}${raw}${post}`, moderation)).toBe(
          validateUsername(raw, moderation)
        );
      })
    );
  });

  test('an accepted username is in bounds, in the alphabet and unfiltered', () => {
    assertProperty(
      'accepted => well formed',
      fc.property(arbRaw, (raw) => {
        if (validateUsername(raw, moderation) !== null) return;
        const name = normalizeUsername(raw);
        expect(name.length).toBeGreaterThanOrEqual(USERNAME_MIN_LENGTH);
        expect(name.length).toBeLessThanOrEqual(USERNAME_MAX_LENGTH);
        expect(isInAlphabet(name)).toBe(true);
        expect(moderation.checkWrite('username', name).allowed).toBe(true);
      })
    );
  });

  test('over the alphabet, length alone decides until the content filter', () => {
    assertProperty(
      'length classification',
      fc.property(arbWellFormed, (name) => {
        const expected =
          name.length === 0
            ? 'empty'
            : name.length < USERNAME_MIN_LENGTH
              ? 'too_short'
              : name.length > USERNAME_MAX_LENGTH
                ? 'too_long'
                : !moderation.checkWrite('username', name).allowed
                  ? 'blocked'
                  : null;
        expect(validateUsername(name, moderation)).toBe(expected);
      })
    );
  });

  test('an in-range name with a character outside the alphabet is invalid_format', () => {
    assertProperty(
      'foreign character => invalid_format',
      fc.property(
        arbWellFormed,
        fc.string({ minLength: 1, maxLength: 1, unit: 'binary' }),
        fc.nat(),
        (name, foreign, at) => {
          fc.pre(!isInAlphabet(foreign) && foreign.trim() === foreign);
          const i = name.length === 0 ? 0 : at % name.length;
          const candidate = `a${name.slice(0, i)}${foreign}${name.slice(i)}`
            .slice(0, USERNAME_MAX_LENGTH)
            .padEnd(USERNAME_MIN_LENGTH, 'z');
          fc.pre(!isInAlphabet(candidate));
          expect(validateUsername(candidate, moderation)).toBe(
            'invalid_format'
          );
        }
      )
    );
  });

  test('lowercasing (what claimUsername stores) never changes the verdict', () => {
    assertProperty(
      'validate(lower(x)) = validate(x)',
      fc.property(arbWellFormed, (name) => {
        expect(validateUsername(name.toLowerCase(), moderation)).toBe(
          validateUsername(name, moderation)
        );
      })
    );
  });
});

describe('canChangeUsername', () => {
  const arbMs = fc.integer({ min: 0, max: 4_102_444_800_000 });

  test('no or unreadable change stamp never blocks a change', () => {
    assertProperty(
      'missing stamp => allowed',
      fc.property(
        fc.constantFrom(null, undefined, '', 'not-a-date'),
        arbMs,
        (stamp, nowMs) => {
          expect(canChangeUsername(stamp, nowMs)).toBe(true);
        }
      )
    );
  });

  test('allowed exactly once the cooldown has elapsed', () => {
    assertProperty(
      'cooldown boundary',
      fc.property(
        arbMs,
        fc.integer({ min: -10_000, max: 10_000 }),
        (changedMs, delta) => {
          const stamp = new Date(changedMs).toISOString();
          const nowMs = changedMs + USERNAME_CHANGE_COOLDOWN_MS + delta;
          expect(canChangeUsername(stamp, nowMs)).toBe(delta >= 0);
        }
      )
    );
  });
});
