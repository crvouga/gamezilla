import { containsBlockedTerm } from '@pkgs/word-filter-shared/match';
import {
  adjectives,
  animals,
  NumberDictionary,
  uniqueNamesGenerator,
} from 'unique-names-generator';

const numberDictionary = NumberDictionary.generate({ length: 3 });

const MAX_GENERATOR_ATTEMPTS = 8;

function generateOnce(seed: number | string | undefined): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals, numberDictionary],
    length: 3,
    separator: '',
    style: 'capital',
    ...(seed !== undefined ? { seed } : {}),
  });
}

/**
 * Single-token username: capitalized adjective + animal + 3-digit number
 * (e.g. `BraveTiger482`). Pass `seed` for deterministic output in tests /
 * collision retries (`seed + attempt`). Candidates the content filter refuses
 * are regenerated from a derived seed.
 */
export function generateRandomUsername(seed?: number | string): string {
  for (let attempt = 0; attempt < MAX_GENERATOR_ATTEMPTS; attempt += 1) {
    const candidate = generateOnce(
      attempt === 0 || seed === undefined
        ? seed
        : `${String(seed)}:${String(attempt)}`
    );
    if (!containsBlockedTerm(candidate)) return candidate;
  }
  return generateOnce(seed);
}
