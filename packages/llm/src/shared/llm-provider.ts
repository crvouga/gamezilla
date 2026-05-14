import type { LlmStructuredRequest, LlmStructuredResult } from './llm-types';

export interface LlmProvider {
  readonly id: string;
  structured(input: LlmStructuredRequest): Promise<LlmStructuredResult>;
}

export class LlmProviderError extends Error {
  readonly __llmProviderError = true as const;

  constructor(
    message: string,
    readonly providerId: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export function isLlmProviderError(value: unknown): value is LlmProviderError {
  return (
    value !== null &&
    typeof value === 'object' &&
    '__llmProviderError' in value
  );
}
