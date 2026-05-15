import { describe, expect, it } from 'bun:test';

import {
  LlmProviderError,
  type LlmProvider,
} from '@gamezilla/llm/shared/llm-provider';
import { LLM_PROVIDER_OPENAI } from '@gamezilla/llm/shared/llm-types';

import { INTENT } from '../src/shared/_internal/intents';
import { createLlmAssistantSpeechResolver } from '../src/shared/speech-resolver-llm';

describe('createLlmAssistantSpeechResolver', () => {
  it('forwards every supplied llm context field into prompt + input', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'Find the fork.' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.praise,
        payloadRef: 'game.x.start.fork.0',
        tags: ['start'],
        locale: 'en',
        meta: {},
        llm: {
          persona: 'You are a chess coach speaking to a single player.',
          grounding: 'Only mention tactics that themeId licenses.',
          tone: 'Tone: opening beat—coach cue, not a verdict.',
          identifiers:
            'moment=start, themeId=fork, payloadRef=game.x.start.fork.0.',
          rules: ['No completion praise unless tags include solved.'],
        },
      },
      new AbortController().signal
    );

    expect(out).toBe('Find the fork.');
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
    expect(body.schemaVersion).toBe('assistant.speech.v10');
    expect(body.model).toBe('gpt-4o-mini');
    expect(body.temperature).toBe(0);

    const instr = String(body.input['instruction']);
    expect(instr).toContain('single short phrase');
    expect(instr).toContain('Plain text only');
    expect(instr).toContain('chess coach speaking to a single player');
    expect(instr).toContain('Only mention tactics that themeId licenses.');
    expect(instr).toContain('opening beat');
    expect(instr).toContain('No completion praise unless tags include solved.');
    expect(instr).toContain('moment=start');

    expect(body.input['intent']).toBe(INTENT.praise);
    expect(body.input['payloadRef']).toBe('game.x.start.fork.0');
    expect(body.input['locale']).toBe('en');
    expect(body.input['llmPersona']).toBe(
      'You are a chess coach speaking to a single player.'
    );
    expect(body.input['llmGrounding']).toBe(
      'Only mention tactics that themeId licenses.'
    );
    expect(body.input['llmTone']).toBe(
      'Tone: opening beat—coach cue, not a verdict.'
    );
    expect(body.input['llmIdentifiers']).toBe(
      'moment=start, themeId=fork, payloadRef=game.x.start.fork.0.'
    );
    expect(body.input['llmRules']).toEqual([
      'No completion praise unless tags include solved.',
    ]);
    expect(body.input['maxChars']).toBe(56);
    expect(body.schema['required']).toEqual(['message']);
    const msgProp = (body.schema['properties'] as Record<string, unknown>)[
      'message'
    ] as Record<string, unknown>;
    expect(msgProp['maxLength']).toBe(56);
  });

  it('works for a third-person sportscaster persona (no coaching baked in)', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'White seizes the center!' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.announce,
        payloadRef: 'chess.bot-vs.move.42',
        tags: ['commentary'],
        locale: 'en',
        meta: {},
        llm: {
          persona:
            'You are a third-person chess commentator narrating a live bot-vs-bot game. Never address the players.',
          tone: 'Tone: punchy sportscaster headline.',
          identifiers: 'mode=bot-vs-bot, moveNumber=42, sideToMove=black.',
        },
      },
      new AbortController().signal
    );
    expect(out).toBe('White seizes the center!');
    const body = calls[0] as { input: Record<string, unknown> };
    const instr = String(body.input['instruction']);
    expect(instr).toContain('third-person chess commentator');
    expect(instr).toContain('sportscaster headline');
    expect(instr).toContain('mode=bot-vs-bot');
    expect(instr).not.toContain('completion praise');
    expect(instr).not.toContain('coach');
  });

  it('works for a battleship taunt with a per-request maxChars override', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'Direct hit!' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.announce,
        payloadRef: 'battleship.hit.0',
        tags: ['hit'],
        locale: 'en',
        meta: {},
        llm: {
          persona:
            'You are a smug opponent in a battleship match. Address the player.',
          tone: 'Tone: short taunt after landing a hit.',
          identifiers: 'event=hit, shipsSunk=0, salvosLeft=12.',
          maxChars: 24,
        },
      },
      new AbortController().signal
    );
    expect(out).toBe('Direct hit!');
    const body = calls[0] as {
      input: Record<string, unknown>;
      schema: Record<string, unknown>;
    };
    expect(body.input['maxChars']).toBe(24);
    const msgProp = (body.schema['properties'] as Record<string, unknown>)[
      'message'
    ] as Record<string, unknown>;
    expect(msgProp['maxLength']).toBe(24);
    const instr = String(body.input['instruction']);
    expect(instr).toContain('within 24 characters');
  });

  it('omitting llm context still produces a usable generic prompt', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'Onward.' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    await r.resolve(
      {
        intent: INTENT.nudge,
        payloadRef: 'r',
        tags: ['something'],
        locale: 'en',
        meta: { engineOnly: true },
      },
      new AbortController().signal
    );
    const body = calls[0] as { input: Record<string, unknown> };
    expect(body.input['llmPersona']).toBeUndefined();
    expect(body.input['llmGrounding']).toBeUndefined();
    expect(body.input['llmTone']).toBeUndefined();
    expect(body.input['llmRules']).toBeUndefined();
    const instr = String(body.input['instruction']);
    expect(instr).toContain('single short phrase');
    expect(instr).toContain('payloadRef=r');
    expect(instr).toContain('signalTags=something');
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

  it('includes history in instruction and llmHistoryLines in structured input', async () => {
    const calls: unknown[] = [];
    const fake: LlmProvider = {
      id: 'fake',
      async structured(input) {
        calls.push(input);
        return { json: { message: 'Next idea.' } };
      },
    };
    const r = createLlmAssistantSpeechResolver(fake);
    const out = await r.resolve(
      {
        intent: INTENT.hint,
        payloadRef: 'p2',
        tags: ['progress'],
        locale: 'en',
        meta: {},
        llm: {
          identifiers: 'moment=progress',
          history: {
            recentLines: [
              {
                payloadRef: 'p1',
                intent: INTENT.hint,
                tags: ['start'],
                text: 'Spot the fork.',
                ageMs: 1200,
              },
            ],
          },
        },
      },
      new AbortController().signal
    );
    expect(out).toBe('Next idea.');
    const body = calls[0] as { input: Record<string, unknown> };
    const instr = String(body.input['instruction']);
    expect(instr).toContain('Recent assistant lines');
    expect(instr).toContain('Spot the fork.');
    const hist = body.input['llmHistoryLines'] as unknown[];
    expect(Array.isArray(hist)).toBe(true);
    expect(hist).toEqual([
      {
        payloadRef: 'p1',
        intent: INTENT.hint,
        tags: ['start'],
        text: 'Spot the fork.',
        ageMs: 1200,
      },
    ]);
  });
});
