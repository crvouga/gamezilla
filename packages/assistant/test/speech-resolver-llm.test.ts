import { describe, expect, it } from 'bun:test';

import {
  LlmProviderError,
  type LlmProvider,
} from '@gamezilla/llm/shared/llm-provider';
import { LLM_PROVIDER_OPENAI } from '@gamezilla/llm/shared/llm-types';

import { INTENT } from '../src/shared/_internal/intents';
import { createLlmAssistantSpeechResolver } from '../src/shared/speech-resolver-llm';

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
        meta: {
          bucket: 'start',
          theme: 'fork',
          variation: 0,
          puzzleCatalogThemes: ['exposedKing', 'fork'],
        },
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
      temperature?: number;
    };
    expect(body.provider).toBe(LLM_PROVIDER_OPENAI);
    expect(body.schemaVersion).toBe('assistant.speech.v7');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0);
    const instr = body.input['instruction'];
    expect(typeof instr).toBe('string');
    expect(instr).toContain('puzzleCatalogThemes=exposedKing|fork');
    expect(instr).toContain('themeId=fork');
    expect(instr).toContain('ONLY allowed when moment=solved');
    expect(instr).toContain('imperative');
    expect(instr).toContain('Moment voice');
    expect(instr).toContain('moment=start');
    expect(instr).toContain('intent=');
    expect(body.input['intent']).toBe(INTENT.praise);
    expect(body.input['payloadRef']).toBe(
      'assistant.chess.puzzle.start.fork.0'
    );
    expect(body.input['locale']).toBe('en');
    expect(body.input['bucket']).toBe('start');
    expect(body.input['theme']).toBe('fork');
    expect(body.input['variation']).toBe(0);
    expect(body.input['maxChars']).toBe(56);
    expect(body.schema['required']).toEqual(['message']);
    const msgProp = (body.schema['properties'] as Record<string, unknown>)[
      'message'
    ] as Record<string, unknown>;
    expect(msgProp['maxLength']).toBe(56);
  });

  it('progress moment prefers short correctness acks, not motivational lines', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: "That's correct." } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.praise,
        payloadRef: 'assistant.chess.puzzle.progress.fork.0',
        tags: ['progress'],
        locale: 'en',
        meta: {
          bucket: 'progress',
          theme: 'fork',
          variation: 0,
          puzzleCatalogThemes: ['fork'],
        },
      },
      new AbortController().signal
    );
    expect(out).toBe("That's correct.");
    const body = calls[0] as { input: Record<string, unknown> };
    const instr = String(body.input['instruction']);
    expect(instr).toContain('moment=progress');
    expect(instr).toContain('motivational progress lines');
    expect(instr).toContain('short correctness acks');
  });

  it('solved moment instruction allows completion praise', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'Great job!' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.praise,
        payloadRef: 'assistant.chess.puzzle.solved.fork.0',
        tags: ['solved'],
        locale: 'en',
        meta: {
          bucket: 'solved',
          theme: 'fork',
          variation: 0,
          puzzleCatalogThemes: ['fork'],
        },
      },
      new AbortController().signal
    );
    expect(out).toBe('Great job!');
    const body = calls[0] as { input: Record<string, unknown> };
    const instr = String(body.input['instruction']);
    expect(instr).toContain('moment=solved');
    expect(instr).toContain('celebratory praise is OK');
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

  it('clips long multi-sentence output to one short phrase', async () => {
    const fake: LlmProvider = {
      id: 'fake',
      async structured() {
        return {
          json: {
            message:
              'This is the first sentence. This is extra rambling that should never appear.',
          },
        };
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
    expect(out).toBe('This is the first sentence.');
  });
});
