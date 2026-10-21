import { predicateCheck } from '@pkgs/moderation-shared-ts/check';
import { normalizeForMatch } from '@pkgs/word-filter-shared-ts/match';

/** Names that would pass a person off as the team behind the app. */
const RESERVED: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'gamezilla',
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

/** `admin`, `Gamezilla_Official`, `m0derator7` — not `badminton`, `supporter`. */
export function isReservedName(text: string): boolean {
  return nameWords(text).some((word) => RESERVED.has(word));
}

export const reservedNameCheck = predicateCheck({
  id: 'impersonation.reserved-name',
  version: 1,
  code: 'reserved_name',
  matches: isReservedName,
});
