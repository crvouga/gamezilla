import { asKeyword, type Keyword } from '@gamezilla/lib/keyword/keyword';

/**
 * {@link Keyword} for a cached structured LLM response. The content hash
 * already folds in `model`, `input`, `schema`, `schemaVersion`, and effective `temperature`.
 */
export function llmKvKey(providerId: string, hash: string): Keyword {
  const local = `${providerId}-${hash}`;
  return asKeyword(`llm.response/${local}`);
}
