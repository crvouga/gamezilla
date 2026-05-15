/** OpenAI is the only supported provider in v1. */
export const LLM_PROVIDER_OPENAI = 'openai' as const;

export type LlmProviderId = typeof LLM_PROVIDER_OPENAI;

export type LlmStructuredRequest = {
  readonly input: Readonly<Record<string, unknown>>;
  readonly schema: Readonly<Record<string, unknown>>;
  readonly model: string;
  readonly provider: LlmProviderId;
  readonly schemaVersion: string;
  /** Sampling temperature; OpenAI chat allows 0–2. Omitted means 0. */
  readonly temperature?: number;
};

/** Wire result from {@link LlmProvider.structured} and `POST /llm/structured`. */
export type LlmStructuredResult = {
  readonly json: Readonly<Record<string, unknown>>;
};
