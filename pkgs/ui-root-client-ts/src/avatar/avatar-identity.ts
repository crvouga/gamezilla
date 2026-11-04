import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';

/** A soft plate and the ink drawn on it: one contrast-checked token pair. */
export type AvatarTone = {
  readonly plate: ColorTokenName;
  readonly ink: ColorTokenName;
};

/**
 * The plates a face without a picture may wear, chosen by who it is. Each is
 * a soft surface with its own ink, so initials hold 4.5:1 in both schemes.
 * The indigo `tintSubtle` plate is left out: it marks your own face.
 */
export const AVATAR_TONES = [
  { plate: 'surfaceMuted', ink: 'text' },
  { plate: 'infoSurface', ink: 'info' },
  { plate: 'successSurface', ink: 'success' },
  { plate: 'warningSurface', ink: 'warning' },
] as const satisfies readonly AvatarTone[];

/**
 * FNV-1a over UTF-16 code units, then a 32-bit finalizer so near-identical
 * keys (`jordan`, `jordy`) spread across tones. Stable across runs and
 * platforms.
 */
function hashKey(key: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < key.length; index += 1) {
    hash ^= key.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** The tone for a stable identity (a profile id): the same key, the same tone. */
export function avatarTone(key: string): AvatarTone {
  const tone = AVATAR_TONES[hashKey(key) % AVATAR_TONES.length];
  return tone ?? AVATAR_TONES[0];
}

const WORD_SEPARATOR = /[\s_.\-@]+/u;
const STARTS_WITH_LETTER = /^\p{L}/u;
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

function firstCharacter(word: string): string {
  return Array.from(word)[0] ?? '';
}

/**
 * Initials for a name or handle: the first letters of its first two words
 * (`jordan_plays` → `JP`, `Ada Lovelace` → `AL`), else its first letter
 * (`jordan` → `J`). Words that start with a digit do not count
 * (`robin_42` → `R`). A leading `@` is ignored; an empty name gives `''`.
 */
export function avatarInitials(name: string): string {
  const words = name
    .trim()
    .split(WORD_SEPARATOR)
    .filter((word) => STARTS_WITH_LETTER.test(word));
  const [first, second] = words;
  if (first === undefined) {
    const fallback = LETTER_OR_DIGIT.exec(name)?.[0] ?? '';
    return fallback.toLocaleUpperCase('en-US');
  }
  const letters =
    second === undefined
      ? firstCharacter(first)
      : `${firstCharacter(first)}${firstCharacter(second)}`;
  return letters.toLocaleUpperCase('en-US');
}
