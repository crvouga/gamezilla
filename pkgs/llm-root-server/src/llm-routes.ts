import type { Kv } from '@pkgs/kv-root-shared/interface';
import { LlmProviderWithKvCache } from '@pkgs/llm-root-shared/llm-cache';
import type { LlmProvider } from '@pkgs/llm-root-shared/llm-provider';
import {
  isLlmProviderError,
  type LlmProviderError,
} from '@pkgs/llm-root-shared/llm-provider';
import type {
  LlmStructuredRequest,
  LlmStructuredResult,
} from '@pkgs/llm-root-shared/llm-types';
import { LLM_PROVIDER_OPENAI } from '@pkgs/llm-root-shared/llm-types';
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

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

type ParsedCore =
  | { readonly success: false; readonly error: string }
  | {
      readonly success: true;
      readonly input: Readonly<Record<string, unknown>>;
      readonly schema: Readonly<Record<string, unknown>>;
    };

function parseStructuredFieldSizes(obj: Record<string, unknown>): ParsedCore {
  const inputRes = parseObjectField(obj['input'], 'input');
  if (!inputRes.ok) {
    return { success: false, error: inputRes.error };
  }
  const schemaRes = parseObjectField(obj['schema'], 'schema');
  if (!schemaRes.ok) {
    return { success: false, error: schemaRes.error };
  }
  const { value: input } = inputRes;
  const { value: schema } = schemaRes;
  if (!jsonSizeOk(input)) {
    return { success: false, error: 'input JSON is too large' };
  }
  if (!jsonSizeOk(schema)) {
    return { success: false, error: 'schema JSON is too large' };
  }
  return { success: true, input, schema };
}

type ParsedIds =
  | { readonly success: false; readonly error: string }
  | {
      readonly success: true;
      readonly model: string;
      readonly schemaVersion: string;
    };

function parseModelSchemaProvider(obj: Record<string, unknown>): ParsedIds {
  if (!isNonEmptyString(obj['model'])) {
    return { success: false, error: 'model must be a non-empty string' };
  }
  if (!isNonEmptyString(obj['schemaVersion'])) {
    return {
      success: false,
      error: 'schemaVersion must be a non-empty string',
    };
  }
  if (obj['provider'] !== LLM_PROVIDER_OPENAI) {
    return {
      success: false,
      error: `provider must be "${LLM_PROVIDER_OPENAI}"`,
    };
  }
  return {
    success: true,
    model: obj['model'].trim(),
    schemaVersion: obj['schemaVersion'].trim(),
  };
}

type ParsedTemp =
  | { readonly error: string }
  | { readonly temperature?: number };

function parseOptionalTemperature(tempRaw: unknown): ParsedTemp {
  if (tempRaw === undefined) {
    return {};
  }
  if (typeof tempRaw !== 'number' || !Number.isFinite(tempRaw)) {
    return { error: 'temperature must be a finite number' };
  }
  if (tempRaw < 0 || tempRaw > 2) {
    return {
      error: 'temperature must be between 0 and 2 (OpenAI chat range)',
    };
  }
  return { temperature: tempRaw };
}

function buildStructuredRequest(parts: {
  readonly input: Readonly<Record<string, unknown>>;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly model: string;
  readonly schemaVersion: string;
  readonly temperature?: number;
}): LlmStructuredRequest {
  const { input, schema, model, schemaVersion, temperature } = parts;
  const base = {
    input,
    schema,
    model,
    provider: LLM_PROVIDER_OPENAI,
    schemaVersion,
  };
  return temperature !== undefined ? { ...base, temperature } : base;
}

function parseStructuredBody(raw: unknown): ParsedStructuredBody {
  if (raw === null || typeof raw !== 'object') {
    return { ok: false, error: 'request body must be a JSON object' };
  }
  const obj = raw as Record<string, unknown>;

  const core = parseStructuredFieldSizes(obj);
  if (!core.success) {
    return { ok: false, error: core.error };
  }

  const ids = parseModelSchemaProvider(obj);
  if (!ids.success) {
    return { ok: false, error: ids.error };
  }

  const temp = parseOptionalTemperature(obj['temperature']);
  if ('error' in temp) {
    return { ok: false, error: temp.error };
  }

  return {
    ok: true,
    body: buildStructuredRequest({
      input: core.input,
      schema: core.schema,
      model: ids.model,
      schemaVersion: ids.schemaVersion,
      ...(temp.temperature !== undefined
        ? { temperature: temp.temperature }
        : {}),
    }),
  };
}

function structuredErrorHttpStatus(
  err: LlmProviderError
): ContentfulStatusCode {
  const s = err.status;
  if (typeof s === 'number' && Number.isInteger(s) && s >= 400 && s <= 599) {
    return s as ContentfulStatusCode;
  }
  return 502;
}

function structuredErrorJson(err: LlmProviderError): Record<string, unknown> {
  const o: Record<string, unknown> = {
    error: err.message,
    providerId: err.providerId,
  };
  if (err.status !== undefined) {
    o['upstreamStatus'] = err.status;
  }
  if (err.upstream?.bodyText !== undefined) {
    o['upstreamBody'] = err.upstream.bodyText;
  }
  if (err.upstream?.bodyJson !== undefined) {
    o['upstreamJson'] = err.upstream.bodyJson;
  }
  return o;
}

/**
 * Hono sub-app for structured LLM JSON.
 *
 * Routes:
 *   - `POST /llm/structured` — resolve from {@link Kv} cache or call provider.
 *     On provider failure: JSON with `error`, `providerId`, optional `upstreamStatus`,
 *     `upstreamBody` (raw text, capped), `upstreamJson` (parsed upstream body).
 *     HTTP status mirrors upstream when it is 4xx/5xx (otherwise 502).
 *     Gated by `requireAuth`. Required: `input`, `schema`, `model`, `provider`,
 *     `schemaVersion`. Optional: `temperature` (0–2, OpenAI chat). Malformed
 *     requests return `400`.
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
      const cachedProvider = new LlmProviderWithKvCache(provider, kv);
      const body: LlmStructuredResult = await cachedProvider.structured(
        parsed.body
      );
      return c.json(body, 200);
    } catch (err: unknown) {
      if (isLlmProviderError(err)) {
        return c.json(structuredErrorJson(err), structuredErrorHttpStatus(err));
      }
      throw err;
    }
  });
}
