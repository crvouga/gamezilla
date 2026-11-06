import type { ColorTokenName } from '@pkgs/ui-root-shared-ts/colors-types';

/**
 * A soft plate, the ink drawn on it and the ring around it: one
 * contrast-checked token set.
 */
export type AvatarTone = {
  readonly plate: ColorTokenName;
  readonly ink: ColorTokenName;
  /**
   * The ring that outlines the face. A soft plate barely differs from the
   * card under it (in dark mode least of all), so the ring holds 3:1 against
   * the canvas and the surface and the circle reads in both schemes.
   */
  readonly ring: ColorTokenName;
};

/**
 * The plates a face without a picture may wear, chosen by who it is. Each is
 * a soft surface with its own ink, so initials hold 4.5:1 in both schemes,
 * and its own ring, so the face holds 3:1 against the card it sits on.
 * The indigo `tintSubtle` plate is left out: it marks your own face.
 */
export const AVATAR_TONES = [
  { plate: 'surfaceMuted', ink: 'text', ring: 'outline' },
  { plate: 'infoSurface', ink: 'info', ring: 'info' },
  { plate: 'successSurface', ink: 'success', ring: 'success' },
  { plate: 'warningSurface', ink: 'warning', ring: 'warning' },
] as const satisfies readonly AvatarTone[];

/** Your own initials: the indigo plate, its ink, and the accent ring. */
export const YOUR_AVATAR_TONE = {
  plate: 'tintSubtle',
  ink: 'onPrimarySoft',
  ring: 'tint',
} as const satisfies AvatarTone;

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
export function avatarTone(key: string): (typeof AVATAR_TONES)[number] {
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
