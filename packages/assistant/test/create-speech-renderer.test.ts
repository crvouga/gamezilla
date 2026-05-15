import { describe, expect, it } from 'bun:test';

import { subscribeAssistantSpeaking } from '../src/client/_internal/assistant-speaking-bridge';
import {
  ASSISTANT_SPEECH_FALLBACK_LINE,
  createAssistantSpeechRenderer,
} from '../src/client/create-speech-renderer';
import type { Assistant } from '../src/shared/index';
import type { AssistantSpeechResolver } from '../src/shared/speech-resolver';
import { INTENT } from '../src/shared/_internal/intents';

function resolverFrom(
  impl: AssistantSpeechResolver['resolve']
): AssistantSpeechResolver {
  return { id: 'test', resolve: impl };
}

async function flushMicrotasks(): Promise<void> {
  await new Promise((r) => setTimeout(r, 5));
}

describe('createAssistantSpeechRenderer', () => {
  it('emits resolved text for speak', async () => {
    const assistant = {} as Assistant<unknown>;
    let last: string | null | undefined;
    subscribeAssistantSpeaking(assistant, (u) => {
      last = u.message;
    });
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async () => 'Find the fork.'),
      getAssistant: () => assistant,
      getLocale: () => 'en',
      timeoutMs: 5000,
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'assistant.chess.puzzle.start.fork.0',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    expect(last).toBe('Find the fork.');
  });

  it('silence clears without calling resolver', async () => {
    const assistant = {} as Assistant<unknown>;
    let calls = 0;
    let last: string | null | undefined = 'x';
    subscribeAssistantSpeaking(assistant, (u) => {
      last = u.message;
    });
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async () => {
        calls += 1;
        return 'nope';
      }),
      getAssistant: () => assistant,
      getLocale: () => 'en',
    });
    renderer.render({
      kind: 'silence',
      reason: 'budget',
      ttlMs: 1,
    });
    await flushMicrotasks();
    expect(calls).toBe(0);
    expect(last).toBeNull();
  });

  it('emits fallback when resolver returns null', async () => {
    const assistant = {} as Assistant<unknown>;
    let last: string | null | undefined;
    subscribeAssistantSpeaking(assistant, (u) => {
      last = u.message;
    });
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async () => null),
      getAssistant: () => assistant,
      getLocale: () => 'en',
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'ref',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    expect(last).toBe(ASSISTANT_SPEECH_FALLBACK_LINE);
  });

  it('drops stale speak when a newer speak arrives', async () => {
    const assistant = {} as Assistant<unknown>;
    const messages: (string | null)[] = [];
    subscribeAssistantSpeaking(assistant, (u) => {
      messages.push(u.message);
    });
    let n = 0;
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async () => {
        n += 1;
        if (n === 1) {
          await new Promise((r) => setTimeout(r, 40));
          return 'late';
        }
        return 'early';
      }),
      getAssistant: () => assistant,
      getLocale: () => 'en',
      timeoutMs: 5000,
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'a',
      tags: [],
      ttlMs: 1,
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'b',
      tags: [],
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 80));
    expect(messages.at(-1)).toBe('early');
    expect(messages.includes('late')).toBe(false);
  });

  it('times out when resolver never settles', async () => {
    const assistant = {} as Assistant<unknown>;
    let last: string | null | undefined = 'init';
    subscribeAssistantSpeaking(assistant, (u) => {
      last = u.message;
    });
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(
        () =>
          new Promise<string | null>(() => {
            /* never */
          })
      ),
      getAssistant: () => assistant,
      getLocale: () => 'en',
      timeoutMs: 25,
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'x',
      tags: [],
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 60));
    expect(last).toBe(ASSISTANT_SPEECH_FALLBACK_LINE);
  });
});
