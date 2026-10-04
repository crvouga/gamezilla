import { assertJsonValue, canonicalJsonStringify } from './json';

/** Stable fingerprint of a JSON-serializable observation slice. */
export function fingerprint(value: unknown): string {
  return canonicalJsonStringify(assertJsonValue(value));
}
