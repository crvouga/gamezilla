import {
  NAMESPACE,
  PRODUCT,
} from '@libs/product-identity-shared-ts/product-identity';
import { predicateCheck } from '@pkgs/moderation-shared-ts/check';
import { normalizeForMatch } from '@pkgs/word-filter-shared-ts/match';

/**
 * The product's own names, every spelling it has had included, as matching
 * sees them (an alias spelled as two words, `Two Words` or `two-words`,
 * becomes the one word `twowords`).
 */
const PRODUCT_NAMES: ReadonlySet<string> = new Set(
  [
    PRODUCT.brand.name,
    PRODUCT.brand.shortName,
    NAMESPACE,
    ...PRODUCT.aliases,
  ].map(normalizeForMatch)
);

/** Names that would pass a person off as the team behind the app. */
const RESERVED: ReadonlySet<string> = new Set([
  ...PRODUCT_NAMES,
  'admin',
  'administrator',
  'moderator',
  'mod',
  'official',
  'staff',
  'support',
]);

/** Words of a name: split on separators and camel case, trailing digits off. */
function nameWords(text: string): readonly string[] {
  return text
    .split(/[\s_.-]+|(?<=[a-z])(?=[A-Z])/)
    .map((word) => normalizeForMatch(word.replace(/\d+$/, '')))
    .filter((word) => word.length > 0);
}

/** Whether consecutive words spell one of the product's names (`Game_Zilla`). */
function spellsProductName(words: readonly string[]): boolean {
  for (let start = 0; start < words.length; start += 1) {
    let joined = '';
    for (let end = start; end < words.length; end += 1) {
      joined += words[end];
      if (PRODUCT_NAMES.has(joined)) return true;
    }
  }
  return false;
}

/**
 * `admin`, `<Product>_Official`, `m0derator7` — not `badminton`, `supporter`.
 */
export function isReservedName(text: string): boolean {
  const words = nameWords(text);
  return words.some((word) => RESERVED.has(word)) || spellsProductName(words);
}

export const reservedNameCheck = predicateCheck({
  id: 'impersonation.reserved-name',
  version: 1,
  code: 'reserved_name',
  matches: isReservedName,
});
