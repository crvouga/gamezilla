import { asKeyword, type Keyword } from '@pkgs/keyword/keyword';

/**
 * {@link Keyword} for a cached structured LLM response. The content hash
 * already folds in `model`, `input`, `schema`, `schemaVersion`, and effective `temperature`.
 *
 * Namespace includes `response-kv2` so installs never read legacy TEXT/JSON
 * blobs shaped as `{ json: ... }` (non-keyword keys) under the old `llm.response/*` keys.
 */
export function llmKvKey(providerId: string, hash: string): Keyword {
  const local = `${providerId}-${hash}`;
  return asKeyword(`llm.response-kv2/${local}`);
}
