/** Sub-relative prefixes composed under the injected root namespace. */
export const ObjectStorePrefix = {
  ttsAudio: 'tts-audio/',
  productHarnessSnapshots: 'product-harness-snapshots/',
} as const;

/** Normalizes a root namespace slug to a wire-key prefix with trailing slash. */
export function normalizeObjectStoreRootPrefix(
  namespace: string
): `${string}/` {
  // One scan, not `/\/+$/`: that regex rescans a run of slashes from every
  // start (quadratic on a long one).
  const spaced = namespace.trim();
  let end = spaced.length;
  while (end > 0 && spaced[end - 1] === '/') end -= 1;
  const trimmed = spaced.slice(0, end);
  if (trimmed.length === 0) {
    throw new Error('Object store root namespace must be non-empty');
  }
  return `${trimmed}/`;
}
