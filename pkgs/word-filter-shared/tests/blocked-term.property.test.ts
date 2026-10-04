import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { BLOCKED_TERMS } from '@pkgs/word-filter-shared/blocklist';
import {
  containsBlockedTerm,
  normalizeForMatch,
} from '@pkgs/word-filter-shared/match';
import fc from 'fast-check';

/** Leetspeak glyphs a person types for a letter (the filter's own table). */
const LEET: Readonly<Record<string, readonly string[]>> = {
  a: ['4', '@'],
  b: ['8'],
  e: ['3'],
  i: ['1', '!', '|'],
  o: ['0'],
  s: ['5', '$'],
  t: ['7'],
};

/** Characters a disguise wedges between letters; none of them is a letter. */
const SEPARATORS = [' ', '.', '_', '-', '*', '~', '#', '​', '2', '9'];

/** Combining accents: `u` + U+0308 renders as `ü`. */
const ACCENTS = ['̀', '́', '̂', '̈', '̧'];

type LetterDisguise = {
  readonly upper: boolean;
  readonly leet: number | null;
  readonly repeat: number;
  readonly accent: string | null;
  readonly separator: string;
};

const arbLetterDisguise: fc.Arbitrary<LetterDisguise> = fc.record({
  upper: fc.boolean(),
  leet: fc.option(fc.nat({ max: 2 }), { nil: null }),
  repeat: fc.integer({ min: 1, max: 4 }),
  accent: fc.option(fc.constantFrom(...ACCENTS), { nil: null }),
  separator: fc
    .array(fc.constantFrom(...SEPARATORS), { maxLength: 3 })
    .map((parts) => parts.join('')),
});

function disguiseLetter(letter: string, d: LetterDisguise): string {
  const glyphs = LEET[letter];
  const base =
    d.leet !== null && glyphs !== undefined
      ? (glyphs[d.leet % glyphs.length] ?? letter)
      : d.upper
        ? letter.toUpperCase()
        : letter;
  return `${base}${d.accent ?? ''}`.repeat(d.repeat) + d.separator;
}

/** A blocked term with every letter independently disguised, in context. */
const arbDisguisedTerm = fc
  .constantFrom(...BLOCKED_TERMS)
  .chain((term) =>
    fc.record({
      term: fc.constant(term),
      letters: fc.array(arbLetterDisguise, {
        minLength: term.length,
        maxLength: term.length,
      }),
      prefix: fc.string({ maxLength: 6 }),
      suffix: fc.string({ maxLength: 6 }),
    })
  )
  .map(({ term, letters, prefix, suffix }) => {
    const body = [...term]
      .map((letter, i) => disguiseLetter(letter, letters[i] as LetterDisguise))
      .join('');
    return { term, text: `${prefix}${body}${suffix}` };
  });

/**
 * Letters no clean word may contain. Every blocked term holds at least one of
 * them (asserted below), so a word whose normalized form avoids them all
 * cannot contain a blocked term — the clean generator is sound by
 * construction, not by filtering.
 */
const HELD_BACK = new Set(['a', 'i', 'o', 'u']);

const SAFE_CHARS = [
  ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.!|@$',
].filter((char) =>
  [...normalizeForMatch(char)].every((letter) => !HELD_BACK.has(letter))
);

const arbCleanWord = fc
  .array(fc.constantFrom(...SAFE_CHARS), { minLength: 1, maxLength: 20 })
  .map((chars) => chars.join(''));

describe('containsBlockedTerm refuses disguised blocked terms', () => {
  test('case, leetspeak, repeats, accents and separators keep a term refused', () => {
    assertProperty(
      'disguised term ⇒ refused',
      fc.property(arbDisguisedTerm, ({ text }) => {
        expect(containsBlockedTerm(text)).toBe(true);
      })
    );
  });

  test('embedding refused text in any context keeps it refused', () => {
    assertProperty(
      'refused is monotone under context',
      fc.property(
        arbDisguisedTerm,
        fc.string({ maxLength: 12 }),
        fc.string({ maxLength: 12 }),
        ({ text }, before, after) => {
          expect(containsBlockedTerm(`${before}${text}${after}`)).toBe(true);
        }
      )
    );
  });
});

describe('containsBlockedTerm accepts clean words', () => {
  test('the clean generator is sound: every term needs a held-back letter', () => {
    for (const term of BLOCKED_TERMS) {
      expect([...term].some((letter) => HELD_BACK.has(letter))).toBe(true);
    }
  });

  test('words from the safe alphabet are accepted', () => {
    assertProperty(
      'safe word ⇒ accepted',
      fc.property(arbCleanWord, (word) => {
        expect(containsBlockedTerm(word)).toBe(false);
      })
    );
  });
});

describe('normalizeForMatch', () => {
  test('lands in lower-case ASCII letters and is idempotent', () => {
    assertProperty(
      'normalize is a projection onto [a-z]*',
      fc.property(fc.string({ unit: 'binary', maxLength: 30 }), (raw) => {
        const once = normalizeForMatch(raw);
        expect(once).toMatch(/^[a-z]*$/);
        expect(normalizeForMatch(once)).toBe(once);
        expect(containsBlockedTerm(once)).toBe(containsBlockedTerm(raw));
      })
    );
  });

  test('ASCII case never changes the verdict', () => {
    assertProperty(
      'verdict is case-insensitive over ASCII',
      fc.property(
        fc.string({ unit: 'grapheme-ascii', maxLength: 30 }),
        (raw) => {
          const verdict = containsBlockedTerm(raw);
          expect(containsBlockedTerm(raw.toUpperCase())).toBe(verdict);
          expect(containsBlockedTerm(raw.toLowerCase())).toBe(verdict);
        }
      )
    );
  });
});
