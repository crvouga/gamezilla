import { assert } from '@pkgs/assert';
import type { HttpClient } from '@pkgs/http-client';

import { type LlmProvider, LlmProviderError } from '../llm-provider';
import type { LlmStructuredRequest, LlmStructuredResult } from '../llm-types';

export type HttpLlmProviderOptions = {
  readonly apiUrl: string;
  readonly http: HttpClient;
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

function parseWorkerErrorJson(detail: string): {
  readonly parsed: unknown;
  readonly rec: Record<string, unknown> | null;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(detail) as unknown;
  } catch {
    return { parsed: undefined, rec: null };
  }
  const rec =
    parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  return { parsed, rec };
}

function workerErrorMessage(
  rec: Record<string, unknown> | null,
  httpStatus: number
): string {
  if (rec !== null && typeof rec['error'] === 'string') {
    return rec['error'];
  }
  return `http llm: HTTP ${httpStatus}`;
}

function workerErrorUpstream(
  detail: string,
  rec: Record<string, unknown> | null,
  parsed: unknown
): { bodyText?: string; bodyJson?: unknown } | undefined {
  const bodyText =
    typeof rec?.['upstreamBody'] === 'string'
      ? rec['upstreamBody']
      : detail.length > 0
        ? detail.slice(0, 16_384)
        : undefined;

  let bodyJson: unknown;
  if (rec === null) {
    bodyJson = undefined;
  } else if (rec['upstreamJson'] !== undefined) {
    bodyJson = rec['upstreamJson'];
  } else {
    bodyJson = parsed;
  }

  if (bodyText === undefined && bodyJson === undefined) {
    return undefined;
  }
  const out: { bodyText?: string; bodyJson?: unknown } = {};
  if (bodyText !== undefined) {
    out.bodyText = bodyText;
  }
  if (bodyJson !== undefined) {
    out.bodyJson = bodyJson;
  }
  return out;
}

function throwHttpStructuredError(
  providerId: string,
  response: Response,
  detail: string
): never {
  const { parsed, rec } = parseWorkerErrorJson(detail);
  const message = workerErrorMessage(rec, response.status);
  const upstream = workerErrorUpstream(detail, rec, parsed);
  throw new LlmProviderError(message, providerId, response.status, upstream);
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
    const http = this.options.http;

    const response = await http.fetch(`${base}/api/llm/structured`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throwHttpStructuredError(this.id, response, detail);
    }

    const raw: unknown = await response.json();
    return assertStructuredResult(raw);
  }
}
