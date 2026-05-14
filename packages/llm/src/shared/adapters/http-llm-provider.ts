import { assert } from '@gamezilla/lib/assert';

import { LlmProviderError, type LlmProvider } from '../llm-provider';
import type { LlmStructuredRequest, LlmStructuredResult } from '../llm-types';

type FetchFn = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

export type HttpLlmProviderOptions = {
  readonly apiUrl: string;
  readonly fetch?: FetchFn;
};

function trimBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function assertStructuredResult(value: unknown): LlmStructuredResult {
  assert.ok(
    value !== null && typeof value === 'object',
    'http llm: response must be object',
    { value }
  );
  const o = value as Record<string, unknown>;
  assert.ok(
    o['json'] !== null && typeof o['json'] === 'object',
    'http llm: response.json must be object',
    { json: o['json'] }
  );
  return {
    json: o['json'] as Readonly<Record<string, unknown>>,
  };
}

/**
 * {@link LlmProvider} that calls `POST {apiUrl}/llm/structured`. Cache with
 * {@link LlmProviderWithKvCache} at the call site; this adapter does no KV I/O.
 */
export class HttpLlmProvider implements LlmProvider {
  readonly id = 'http';

  constructor(private readonly options: HttpLlmProviderOptions) {}

  async structured(input: LlmStructuredRequest): Promise<LlmStructuredResult> {
    const base = trimBaseUrl(this.options.apiUrl);
    const fetchFn =
      this.options.fetch ?? ((url, init) => globalThis.fetch(url, init));

    const response = await fetchFn(`${base}/llm/structured`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new LlmProviderError(
        `http llm: HTTP ${response.status} — ${detail.slice(0, 256)}`,
        this.id,
        response.status
      );
    }

    const raw: unknown = await response.json();
    return assertStructuredResult(raw);
  }
}
