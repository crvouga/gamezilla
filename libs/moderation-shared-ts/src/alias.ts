import { containsBlockedTerm } from '@pkgs/word-filter-shared-ts/match';
import {
  adjectives,
  animals,
  NumberDictionary,
  uniqueNamesGenerator,
} from 'unique-names-generator';

const numbers = NumberDictionary.generate({ length: 3 });
const MAX_ATTEMPTS = 8;

function aliasOnce(seed: string): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals, numbers],
    length: 3,
    separator: ' ',
    style: 'capital',
    seed,
  });
}

/**
 * Stable stand-in name for a subject whose own name is masked
 * (`Brave Tiger 482`). Spaces keep it out of the username alphabet, so an
 * alias can never impersonate a real person's username.
 */
export function moderationAlias(subjectId: string): string {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const candidate = aliasOnce(`${subjectId}:alias:${String(attempt)}`);
    if (!containsBlockedTerm(candidate)) return candidate;
  }
  return aliasOnce(`${subjectId}:alias`);
}
