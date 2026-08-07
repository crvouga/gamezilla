/**
 * Server-side facade for `@pkgs/llm`.
 */

export {
  HttpLlmProvider,
  type HttpLlmProviderOptions,
} from '../shared/adapters/http-llm-provider';
export { LlmProviderWithKvCache } from '../shared/llm-cache';
export { llmKvKey } from '../shared/llm-kv-key';
export {
  isLlmProviderError,
  type LlmProvider,
  LlmProviderError,
  type LlmProviderErrorUpstream,
} from '../shared/llm-provider';
export type {
  LlmStructuredRequest,
  LlmStructuredResult,
} from '../shared/llm-types';
export { createLlmInMemoryKv } from './adapters/kv-cache-in-memory';
export { createLlmPostgresKv } from './adapters/kv-cache-postgres';
export {
  OpenAiLlmProvider,
  type OpenAiLlmProviderOptions,
} from './adapters/openai-llm-provider';
export {
  type CreateLlmAppFromBindingsOptions,
  createLlmAppFromBindings,
  LlmSecretName,
} from './llm-from-bindings';
export {
  type CreateLlmAppOptions,
  createLlmApp,
  type LlmGetKv,
  type LlmRequireAuth,
} from './llm-routes';
