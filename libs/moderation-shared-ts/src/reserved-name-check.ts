import {
  NAMESPACE,
  PRODUCT,
} from '@libs/product-identity-shared-ts/product-identity';
import { predicateCheck } from '@pkgs/moderation-shared-ts/check';
import { normalizeForMatch } from '@pkgs/word-filter-shared-ts/match';

/** Words that would pass a person off as the team behind the app. */
const TEAM_WORDS: readonly string[] = [
  'admin',
  'administrator',
  'moderator',
  'mod',
  'official',
  'staff',
  'support',
];

/** Words of a name: split on separators and camel case, trailing digits off. */
function nameWords(text: string): readonly string[] {
  return text
    .split(/[\s_.-]+|(?<=[a-z])(?=[A-Z])/)
    .map((word) => normalizeForMatch(word.replace(/\d+$/, '')))
    .filter((word) => word.length > 0);
}

/** Whether consecutive words spell one of `names` (`Two_Words`). */
function spellsName(
  words: readonly string[],
  names: ReadonlySet<string>
): boolean {
  for (let start = 0; start < words.length; start += 1) {
    let joined = '';
    for (let end = start; end < words.length; end += 1) {
      joined += words[end];
      if (names.has(joined)) return true;
    }
  }
  return false;
}

/**
 * A reserved-name test for a product called `productNames`: `admin`,
 * `<Product>_Official`, `m0derator7` — not `badminton`, `supporter`. A
 * product name is read the way a person's name is (split into words,
 * trailing digits off each, normalized), so a brand with digits in it is
 * refused like any other.
 */
export function reservedNameMatcher(
  productNames: readonly string[]
): (text: string) => boolean {
  const names = new Set(productNames.map((name) => nameWords(name).join('')));
  const reserved = new Set([...names, ...TEAM_WORDS]);
  return (text) => {
    const words = nameWords(text);
    return words.some((word) => reserved.has(word)) || spellsName(words, names);
  };
}

/** The product's own names, every spelling it has had included. */
export const isReservedName = reservedNameMatcher([
  PRODUCT.brand.name,
  PRODUCT.brand.shortName,
  NAMESPACE,
  ...PRODUCT.aliases,
]);

export const reservedNameCheck = predicateCheck({
  id: 'impersonation.reserved-name',
  version: 1,
  code: 'reserved_name',
  matches: isReservedName,
});
