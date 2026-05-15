import type { LlmStructuredRequest } from './llm-types';

export type LlmCacheKeyInput = {
  readonly providerId: string;
  readonly model: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly schemaVersion: string;
  readonly temperature: number;
};

const HASH_HEX_LEN = 32;

function canonicalJson(input: LlmCacheKeyInput): string {
  const ordered = {
    input: input.input,
    model: input.model,
    providerId: input.providerId,
    schema: input.schema,
    schemaVersion: input.schemaVersion,
    temperature: input.temperature,
  };
  return JSON.stringify(ordered);
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

export function llmCacheKeyFromRequest(
  providerId: string,
  req: LlmStructuredRequest
): Promise<string> {
  return llmCacheKey({
    providerId,
    model: req.model,
    input: req.input,
    schema: req.schema,
    schemaVersion: req.schemaVersion,
    temperature: req.temperature ?? 0,
  });
}

export async function llmCacheKey(input: LlmCacheKeyInput): Promise<string> {
  const canonical = canonicalJson(input);
  const encoded = new TextEncoder().encode(canonical);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const hex = bytesToHex(new Uint8Array(digest));
  return hex.slice(0, HASH_HEX_LEN);
}
