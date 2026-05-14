import type { Kv } from '@gamezilla/lib/kv/interface';
import { Hono } from 'hono';
import {
  LLM_PROVIDER_OPENAI,
  type LlmStructuredRequest,
  type LlmStructuredResult,
} from '../shared/llm-types';
import { withKvCache } from '../shared/llm-cache';
import {
  LlmProviderError,
  isLlmProviderError,
  type LlmProvider,
} from '../shared/llm-provider';

const CANONICAL_JSON_MAX = 80_000;

export type LlmRequireAuth = (req: Request) => Promise<unknown>;

export type LlmGetKv = () => Kv;

export type CreateLlmAppOptions = {
  readonly provider: LlmProvider;
  readonly getKv: LlmGetKv;
  readonly requireAuth: LlmRequireAuth;
};

type ParsedStructuredBody =
  | { readonly ok: true; readonly body: LlmStructuredRequest }
  | { readonly ok: false; readonly error: string };

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseObjectField(
  raw: unknown,
  field: string
):
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly error: string } {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: `${field} must be a JSON object` };
  }
  return { ok: true, value: raw as Readonly<Record<string, unknown>> };
}

function jsonSizeOk(value: unknown): boolean {
  const s = JSON.stringify(value);
  return s.length <= CANONICAL_JSON_MAX;
}

function parseStructuredBody(raw: unknown): ParsedStructuredBody {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const obj = raw as Record<string, unknown>;

  const inputRes = parseObjectField(obj['input'], 'input');
  if (!inputRes.ok) return { ok: false, error: inputRes.error };
  const input = inputRes.value;

  const schemaRes = parseObjectField(obj['schema'], 'schema');
  if (!schemaRes.ok) return { ok: false, error: schemaRes.error };
  const schema = schemaRes.value;

  if (!jsonSizeOk(input)) {
    return { ok: false, error: 'input JSON is too large' };
  }
  if (!jsonSizeOk(schema)) {
    return { ok: false, error: 'schema JSON is too large' };
  }

  if (!isNonEmptyString(obj['model'])) {
    return { ok: false, error: 'model must be a non-empty string' };
  }
  const model = obj['model'].trim();

  if (!isNonEmptyString(obj['schemaVersion'])) {
    return { ok: false, error: 'schemaVersion must be a non-empty string' };
  }
  const schemaVersion = obj['schemaVersion'].trim();

  const provider = obj['provider'];
  if (provider !== LLM_PROVIDER_OPENAI) {
    return {
      ok: false,
      error: `provider must be "${LLM_PROVIDER_OPENAI}"`,
    };
  }

  const body: LlmStructuredRequest = {
    input,
    schema,
    model,
    provider: LLM_PROVIDER_OPENAI,
    schemaVersion,
  };
  return { ok: true, body };
}

/**
 * Hono sub-app for structured LLM JSON.
 *
 * Routes:
 *   - `POST /llm/structured` — resolve from {@link Kv} cache or call provider.
 *     Gated by `requireAuth`. Body fields are all required; malformed requests
 *     return `400`.
 */
export function createLlmApp(options: CreateLlmAppOptions) {
  const { provider, getKv, requireAuth } = options;

  return new Hono().post('/llm/structured', async (c) => {
    await requireAuth(c.req.raw);

    const raw: unknown = await c.req.json().catch(() => null);
    const parsed = parseStructuredBody(raw);
    if (!parsed.ok) {
      return c.json({ error: parsed.error }, 400);
    }

    try {
      const kv = getKv();
      const cachedProvider = withKvCache(provider, kv);
      const body: LlmStructuredResult = await cachedProvider.structured(
        parsed.body
      );
      return c.json(body, 200);
    } catch (err: unknown) {
      if (isLlmProviderError(err)) {
        return c.json(
          { error: err.message, providerId: err.providerId },
          502
        );
      }
      throw err;
    }
  });
}

export { LlmProviderError };
