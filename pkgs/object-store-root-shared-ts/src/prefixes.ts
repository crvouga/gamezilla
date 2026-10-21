/** Sub-relative prefixes composed under the injected root namespace. */
export const ObjectStorePrefix = {
  ttsAudio: 'tts-audio/',
  productHarnessSnapshots: 'product-harness-snapshots/',
} as const;

/** Normalizes a root namespace slug to a wire-key prefix with trailing slash. */
export function normalizeObjectStoreRootPrefix(
  namespace: string
): `${string}/` {
  const trimmed = namespace.trim().replace(/\/+$/, '');
  if (trimmed.length === 0) {
    throw new Error('Object store root namespace must be non-empty');
  }
  return `${trimmed}/`;
}
