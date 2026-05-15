import { describe, expect, it } from 'bun:test';

import {
  LlmProviderError,
  type LlmProvider,
} from '@gamezilla/llm/shared/llm-provider';
import { LLM_PROVIDER_OPENAI } from '@gamezilla/llm/shared/llm-types';

import { createLlmAssistantSpeechResolver } from '../src/shared/speech-resolver-llm';
import { INTENT } from '../src/shared/_internal/intents';

describe('createLlmAssistantSpeechResolver', () => {
  it('builds structured request and returns message', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'Hi' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.praise,
        payloadRef: 'assistant.chess.puzzle.start.fork.0',
        tags: ['progress'],
        locale: 'en',
        meta: { bucket: 'start', theme: 'fork', variation: 0 },
      },
      new AbortController().signal
    );
    expect(out).toBe('Hi');
    expect(calls.length).toBe(1);
    const body = calls[0] as {
      provider: string;
      schemaVersion: string;
      model: string;
      input: Record<string, unknown>;
      schema: Record<string, unknown>;
    };
    expect(body.provider).toBe(LLM_PROVIDER_OPENAI);
    expect(body.schemaVersion).toBe('gamezilla.assistant.speech.v1');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.input['intent']).toBe(INTENT.praise);
    expect(body.input['payloadRef']).toBe(
      'assistant.chess.puzzle.start.fork.0'
    );
    expect(body.input['locale']).toBe('en');
    expect(body.input['bucket']).toBe('start');
    expect(body.input['theme']).toBe('fork');
    expect(body.input['variation']).toBe(0);
    expect(body.input['maxChars']).toBe(140);
    expect(body.schema['required']).toEqual(['message']);
  });

  it('returns null on LlmProviderError', async () => {
    const fake: LlmProvider = {
      id: 'fake',
      async structured() {
        throw new LlmProviderError('x', 'openai', 502);
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.nudge,
        payloadRef: 'r',
        tags: [],
        locale: 'en',
        meta: {},
      },
      new AbortController().signal
    );
    expect(out).toBeNull();
  });

  it('returns null when already aborted', async () => {
    const fake: LlmProvider = {
      id: 'fake',
      async structured() {
        return { json: { message: 'no' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const ac = new AbortController();
    ac.abort();
    const out = await r.resolve(
      {
        intent: INTENT.nudge,
        payloadRef: 'r',
        tags: [],
        locale: 'en',
        meta: {},
      },
      ac.signal
    );
    expect(out).toBeNull();
  });
});
