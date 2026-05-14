import { assert } from '@gamezilla/lib/assert';

import type { LlmStructuredResult } from './llm-types';

export function serializeLlmStructuredCacheValue(
  body: LlmStructuredResult
): string {
  return JSON.stringify({ json: body.json });
}

export function parseLlmStructuredCacheValue(raw: string): LlmStructuredResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    assert.fail('llm cache: JSON parse failed', { raw: raw.slice(0, 200) });
  }
  assert.ok(
    parsed !== null && typeof parsed === 'object',
    'llm cache: root must be object',
    { parsed }
  );
  const o = parsed as Record<string, unknown>;
  assert.ok(
    o['json'] !== null && typeof o['json'] === 'object',
    'llm cache: json object',
    { json: o['json'] }
  );
  return {
    json: o['json'] as Readonly<Record<string, unknown>>,
  };
}
