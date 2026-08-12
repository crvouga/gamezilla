import type { HttpClient } from '@pkgs/http-client';
import type { SecretStore } from '@pkgs/secret-store';
import { Hono } from 'hono';
import type { LlmProvider } from '../shared/llm-provider';
import { OpenAiLlmProvider } from './adapters/openai-llm-provider';
import {
  type CreateLlmAppOptions,
  createLlmApp,
  type LlmGetKv,
  type LlmRequireAuth,
} from './llm-routes';

/**
 * Secret names read by {@link createLlmAppFromBindings}. Mirror in the host's
 * {@link ApiSecretName} registry.
 */
export const LlmSecretName = {
  openAiApiKey: 'OPENAI_API_KEY',
  openAiBaseUrl: 'OPENAI_BASE_URL',
} as const;

export type CreateLlmAppFromBindingsOptions = {
  readonly secretStore: SecretStore;
  readonly getKv: LlmGetKv;
  readonly requireAuth: LlmRequireAuth;
  readonly http: HttpClient;
  /** When set, skips secret lookup and mounts a configured app. */
  readonly provider?: LlmProvider;
};

export type CreateLlmAppFromBindingsResult = {
  readonly app: Hono;
  readonly configured: boolean;
};

function createUnconfiguredLlmApp(): Hono {
  return new Hono().post('/llm/structured', (c) =>
    c.json({ error: 'LLM is not configured' }, 503)
  );
}

function trimOrNull(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

/**
 * Pre-wired Hono sub-app: loads OpenAI credentials from the secret store.
 * When either secret is missing, mounts a degraded surface that returns 503.
 * Pass {@link CreateLlmAppFromBindingsOptions.provider} to skip secrets
 * (sims / tests).
 */
export async function createLlmAppFromBindings(
  options: CreateLlmAppFromBindingsOptions
): Promise<CreateLlmAppFromBindingsResult> {
  if (options.provider !== undefined) {
    return {
      configured: true,
      app: createLlmApp({
        provider: options.provider,
        getKv: options.getKv,
        requireAuth: options.requireAuth,
      }),
    };
  }

  const apiKey = trimOrNull(
    (
      await options.secretStore.getOptional(LlmSecretName.openAiApiKey)
    )?.readSecretValue()
  );
  const baseUrl = trimOrNull(
    (
      await options.secretStore.getOptional(LlmSecretName.openAiBaseUrl)
    )?.readSecretValue()
  );
  if (apiKey === null || baseUrl === null) {
    return { app: createUnconfiguredLlmApp(), configured: false };
  }

  const provider = new OpenAiLlmProvider({
    apiKey,
    baseUrl,
    http: options.http,
  });

  const createOptions: CreateLlmAppOptions = {
    provider,
    getKv: options.getKv,
    requireAuth: options.requireAuth,
  };
  return { app: createLlmApp(createOptions), configured: true };
}
