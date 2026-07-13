import {
  NumberDictionary,
  adjectives,
  animals,
  uniqueNamesGenerator,
} from 'unique-names-generator';

const numberDictionary = NumberDictionary.generate({ length: 3 });

/**
 * Single-token username: capitalized adjective + animal + 3-digit number
 * (e.g. `BraveTiger482`). Pass `seed` for deterministic output in tests /
 * collision retries (`seed + attempt`).
 */
export function generateRandomUsername(seed?: number | string): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, animals, numberDictionary],
    length: 3,
    separator: '',
    style: 'capital',
    ...(seed !== undefined ? { seed } : {}),
  });
}
