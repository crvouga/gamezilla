import type { LlmStructuredRequest, LlmStructuredResult } from './llm-types';

export interface LlmProvider {
  readonly id: string;
  structured(input: LlmStructuredRequest): Promise<LlmStructuredResult>;
}

/** Raw upstream payload when an LLM HTTP call fails (for API debugging). */
export type LlmProviderErrorUpstream = {
  readonly bodyText?: string;
  readonly bodyJson?: unknown;
};

export class LlmProviderError extends Error {
  readonly __llmProviderError = true as const;

  constructor(
    message: string,
    readonly providerId: string,
    /** Upstream HTTP status when the failure was an HTTP error response. */
    readonly status?: number,
    readonly upstream?: LlmProviderErrorUpstream
  ) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

export function isLlmProviderError(value: unknown): value is LlmProviderError {
  return (
    value !== null && typeof value === 'object' && '__llmProviderError' in value
  );
}
