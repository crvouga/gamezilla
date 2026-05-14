/** OpenAI is the only supported provider in v1. */
export const LLM_PROVIDER_OPENAI = 'openai' as const;

export type LlmProviderId = typeof LLM_PROVIDER_OPENAI;

export type LlmStructuredRequest = {
  readonly input: Readonly<Record<string, unknown>>;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly model: string;
  readonly provider: LlmProviderId;
  readonly schemaVersion: string;
};

/** Wire result from {@link LlmProvider.structured} and `POST /llm/structured`. */
export type LlmStructuredResult = {
  readonly json: Readonly<Record<string, unknown>>;
};
