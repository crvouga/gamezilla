import { describe, expect, it } from 'bun:test';

import { subscribeAssistantSpeaking } from '../src/client/_internal/assistant-speaking-bridge';
import { createAssistantSpeechRenderer } from '../src/client/create-speech-renderer';
import type { Assistant } from '../src/shared/index';
import type { AssistantSpeechResolver } from '../src/shared/speech-resolver';
import type { AssistantSpeakingUpdate } from '../src/client/_internal/assistant-speaking-bridge';
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

  it('stays in loading state when resolver returns null (no error string)', async () => {
    const assistant = {} as Assistant<unknown>;
    const updates: AssistantSpeakingUpdate[] = [];
    subscribeAssistantSpeaking(assistant, (u) => {
      updates.push(u);
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
    // First (and only) update should be the resolving/loading state. The
    // renderer must never surface an error string to the player.
    expect(updates.length).toBe(1);
    expect(updates[0]!.message).toBeNull();
    expect(updates[0]!.bubbleResolving).toBe(true);
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

  it('stays in loading state when resolver times out', async () => {
    const assistant = {} as Assistant<unknown>;
    const updates: AssistantSpeakingUpdate[] = [];
    subscribeAssistantSpeaking(assistant, (u) => {
      updates.push(u);
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
    expect(updates.length).toBe(1);
    expect(updates[0]!.message).toBeNull();
    expect(updates[0]!.bubbleResolving).toBe(true);
  });

  it('passes growing recentLines to llmContextFromAction after each success', async () => {
    const assistant = {} as Assistant<unknown>;
    const lengths: number[] = [];
    subscribeAssistantSpeaking(assistant, () => {});
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async (req) => {
        if (req.payloadRef === 'first') return 'Alpha';
        return 'Beta';
      }),
      getAssistant: () => assistant,
      getLocale: () => 'en',
      llmContextFromAction: (_a, h) => {
        lengths.push(h.recentLines.length);
        return { identifiers: 'test=1' };
      },
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'first',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'second',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    expect(lengths).toEqual([0, 1]);
  });

  it('does not append history when resolver returns null', async () => {
    const assistant = {} as Assistant<unknown>;
    const lengths: number[] = [];
    subscribeAssistantSpeaking(assistant, () => {});
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async () => null),
      getAssistant: () => assistant,
      getLocale: () => 'en',
      llmContextFromAction: (_a, h) => {
        lengths.push(h.recentLines.length);
        return { identifiers: 'x' };
      },
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'a',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'b',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    expect(lengths).toEqual([0, 0]);
  });

  it('caps history at historySize', async () => {
    const assistant = {} as Assistant<unknown>;
    let lastTexts: readonly string[] = [];
    subscribeAssistantSpeaking(assistant, () => {});
    let n = 0;
    const renderer = createAssistantSpeechRenderer({
      resolver: resolverFrom(async () => {
        n += 1;
        return `L${n}`;
      }),
      getAssistant: () => assistant,
      getLocale: () => 'en',
      historySize: 2,
      llmContextFromAction: (_a, h) => {
        lastTexts = h.recentLines.map((l) => l.text);
        return { identifiers: 'cap=test' };
      },
    });
    for (let i = 0; i < 3; i += 1) {
      renderer.render({
        kind: 'speak',
        intent: INTENT.nudge,
        payloadRef: `r${i}`,
        tags: [],
        ttlMs: 1,
      });
      await flushMicrotasks();
    }
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'r3',
      tags: [],
      ttlMs: 1,
    });
    await flushMicrotasks();
    expect(lastTexts).toEqual(['L2', 'L3']);
  });
});
