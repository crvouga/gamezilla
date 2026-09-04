import type { HttpClient } from '@pkgs/http-client';

import {
  type LlmProvider,
  LlmProviderError,
} from '@pkgs/llm/shared/llm-provider';
import type {
  LlmStructuredRequest,
  LlmStructuredResult,
} from '@pkgs/llm/shared/llm-types';

export type OpenAiLlmProviderOptions = {
  readonly apiKey: string;
  readonly baseUrl: string;
  readonly http: HttpClient;
};

type OpenAiChatMessage = {
  readonly role: 'system' | 'user';
  readonly content: string;
};

type OpenAiChatCompletionBody = {
  readonly model: string;
  readonly temperature: number;
  readonly messages: readonly OpenAiChatMessage[];
  readonly response_format: {
    readonly type: 'json_schema';
    readonly json_schema: {
      readonly name: string;
      readonly schema: Readonly<Record<string, unknown>>;
    };
  };
};

function trimTrailingSlashes(url: string): string {
  return url.replace(/\/+$/, '');
}

function buildUrl(baseUrl: string): string {
  return `${trimTrailingSlashes(baseUrl)}/v1/chat/completions`;
}

const UPSTREAM_ERROR_BODY_MAX = 16_384;

function upstreamFromHttpError(
  status: number,
  bodyText: string
): { message: string; upstream: { bodyText: string; bodyJson?: unknown } } {
  const capped =
    bodyText.length > UPSTREAM_ERROR_BODY_MAX
      ? `${bodyText.slice(0, UPSTREAM_ERROR_BODY_MAX)}…`
      : bodyText;
  let bodyJson: unknown;
  try {
    bodyJson = JSON.parse(bodyText) as unknown;
  } catch {
    bodyJson = undefined;
  }
  return {
    message: `openai: HTTP ${status}`,
    upstream:
      bodyJson !== undefined
        ? { bodyText: capped, bodyJson }
        : { bodyText: capped },
  };
}

function readContentFromChoice(choice: unknown): string {
  if (choice === null || typeof choice !== 'object') {
    throw new LlmProviderError(
      'openai: invalid choice shape',
      'openai',
      undefined
    );
  }
  const c = choice as Record<string, unknown>;
  const msg = c['message'];
  if (msg === null || typeof msg !== 'object') {
    throw new LlmProviderError('openai: missing message', 'openai', undefined);
  }
  const content = (msg as Record<string, unknown>)['content'];
  if (typeof content !== 'string' || content.length === 0) {
    throw new LlmProviderError(
      'openai: empty message content',
      'openai',
      undefined
    );
  }
  return content;
}

function parseJsonObject(content: string): Readonly<Record<string, unknown>> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content) as unknown;
  } catch {
    throw new LlmProviderError(
      'openai: assistant content is not JSON',
      'openai',
      undefined
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new LlmProviderError(
      'openai: assistant JSON must be object',
      'openai',
      undefined
    );
  }
  return parsed as Readonly<Record<string, unknown>>;
}

/**
 * OpenAI Chat Completions with `response_format.type = json_schema`.
 */
export class OpenAiLlmProvider implements LlmProvider {
  readonly id = 'openai';

  constructor(private readonly options: OpenAiLlmProviderOptions) {}

  async structured(input: LlmStructuredRequest): Promise<LlmStructuredResult> {
    const url = buildUrl(this.options.baseUrl);
    const body: OpenAiChatCompletionBody = {
      model: input.model,
      temperature: input.temperature ?? 0,
      messages: [
        {
          role: 'system',
          content:
            'You output JSON only. The JSON must validate against the provided JSON Schema.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            input: input.input,
            schemaVersion: input.schemaVersion,
          }),
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'llm_structured_output',
          schema: input.schema,
        },
      },
    };

    const http = this.options.http;
    const response = await http.fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const { message, upstream } = upstreamFromHttpError(
        response.status,
        detail
      );
      throw new LlmProviderError(message, 'openai', response.status, upstream);
    }

    const raw = (await response.json()) as unknown;
    if (raw === null || typeof raw !== 'object') {
      throw new LlmProviderError(
        'openai: invalid JSON body',
        'openai',
        undefined
      );
    }
    const root = raw as Record<string, unknown>;
    const choices = root['choices'];
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new LlmProviderError(
        'openai: missing choices',
        'openai',
        undefined
      );
    }
    const first = choices[0];
    const content = readContentFromChoice(first);
    const json = parseJsonObject(content);
    return { json };
  }
}
