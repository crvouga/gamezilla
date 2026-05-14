import type { SecretStore } from '@gamezilla/lib/secret-store';
import { OpenAiLlmProvider } from './adapters/openai-llm-provider';
import {
  createLlmApp,
  type CreateLlmAppOptions,
  type LlmGetKv,
  type LlmRequireAuth,
} from './llm-routes';

/**
 * Doppler keys read by {@link createLlmAppFromBindings}. Mirror in the host's
 * {@link ApiSecretName} registry.
 */
export const LlmDopplerKey = {
  openAiApiKey: 'OPENAI_API_KEY',
  openAiBaseUrl: 'OPENAI_BASE_URL',
} as const;

export type CreateLlmAppFromBindingsOptions = {
  readonly secretStore: SecretStore;
  readonly getKv: LlmGetKv;
  readonly requireAuth: LlmRequireAuth;
};

/**
 * Pre-wired Hono sub-app: loads OpenAI credentials from Doppler and mounts
 * {@link createLlmApp}. Both secrets are required — the secret store crashes
 * if either is missing.
 */
export async function createLlmAppFromBindings(
  options: CreateLlmAppFromBindingsOptions
): Promise<ReturnType<typeof createLlmApp>> {
  const apiKey = await options.secretStore.getRequired(LlmDopplerKey.openAiApiKey);
  const baseUrl = await options.secretStore.getRequired(LlmDopplerKey.openAiBaseUrl);

  const provider = new OpenAiLlmProvider({
    apiKey,
    baseUrl,
  });

  const createOptions: CreateLlmAppOptions = {
    provider,
    getKv: options.getKv,
    requireAuth: options.requireAuth,
  };
  return createLlmApp(createOptions);
}
