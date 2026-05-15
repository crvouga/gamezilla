import {
  isLlmProviderError,
  type LlmProvider,
} from '@gamezilla/llm/shared/llm-provider';
import { LLM_PROVIDER_OPENAI } from '@gamezilla/llm/shared/llm-types';

import type { AssistantSpeechRequest, AssistantSpeechResolver } from './speech-resolver';

const DEFAULT_SCHEMA_VERSION = 'gamezilla.assistant.speech.v1';
const DEFAULT_MODEL = 'gpt-4o-mini';

const ASSISTANT_SPEECH_JSON_SCHEMA: Readonly<Record<string, unknown>> = {
  type: 'object',
  properties: {
    message: { type: 'string', maxLength: 140 },
  },
  required: ['message'],
  additionalProperties: false,
};

export type CreateLlmAssistantSpeechResolverOptions = {
  readonly schemaVersion?: string;
  readonly model?: string;
};

/**
 * Maps {@link AssistantSpeechRequest} to {@link LlmProvider.structured}.
 * The only module in `@gamezilla/assistant` that imports `@gamezilla/llm`.
 */
export function createLlmAssistantSpeechResolver(
  llm: LlmProvider,
  options?: CreateLlmAssistantSpeechResolverOptions
): AssistantSpeechResolver {
  const schemaVersion = options?.schemaVersion ?? DEFAULT_SCHEMA_VERSION;
  const model = options?.model ?? DEFAULT_MODEL;

  return {
    id: `llm:${llm.id}`,
    async resolve(
      request: AssistantSpeechRequest,
      signal: AbortSignal
    ): Promise<string | null> {
      if (signal.aborted) {
        return null;
      }
      const input: Record<string, unknown> = {
        intent: request.intent,
        payloadRef: request.payloadRef,
        tags: request.tags,
        locale: request.locale,
        maxChars: 140,
        ...request.meta,
      };

      try {
        const { json } = await llm.structured({
          input,
          schema: ASSISTANT_SPEECH_JSON_SCHEMA,
          model,
          provider: LLM_PROVIDER_OPENAI,
          schemaVersion,
        });
        if (signal.aborted) {
          return null;
        }
        const raw = json['message'];
        if (typeof raw !== 'string') {
          return null;
        }
        const trimmed = raw.trim();
        return trimmed.length > 0 ? trimmed : null;
      } catch (err: unknown) {
        if (signal.aborted) {
          return null;
        }
        if (isLlmProviderError(err)) {
          return null;
        }
        throw err;
      }
    },
  };
}
