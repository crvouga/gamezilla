import { describe, expect, it } from 'bun:test';

import { subscribeAssistantSpeaking } from '../src/client/_internal/assistant-speaking-bridge';
import { createAssistantDialogueTreeRenderer } from '../src/client/create-dialogue-tree-renderer';
import type { AssistantSpeakingUpdate } from '../src/client/_internal/assistant-speaking-bridge';
import type { Assistant } from '../src/shared/index';
import { defineDialogueTree } from '../src/shared/dialogue-tree';
import { INTENT } from '../src/shared/_internal/intents';
import type { AssistantClock } from '../src/shared/_internal/clock';

function createFakeClock(): AssistantClock & {
  readonly advance: (ms: number) => void;
} {
  let now = 0;
  type Task = { readonly at: number; readonly fn: () => void };
  const tasks: Task[] = [];

  return {
    now: () => now,
    setTimeout(fn, ms) {
      const at = now + ms;
      const task: Task = { at, fn };
      tasks.push(task);
      return {
        cancel() {
          const i = tasks.indexOf(task);
          if (i >= 0) tasks.splice(i, 1);
        },
      };
    },
    advance(ms: number) {
      const target = now + ms;
      while (tasks.length > 0) {
        const next = tasks.reduce((min, t) => (t.at < min.at ? t : min));
        if (next.at > target) break;
        const idx = tasks.indexOf(next);
        tasks.splice(idx, 1);
        now = next.at;
        next.fn();
      }
      now = target;
    },
  };
}

describe('createAssistantDialogueTreeRenderer', () => {
  it('emits a single line for single-node lookup', () => {
    const assistant = {} as Assistant<unknown>;
    const updates: AssistantSpeakingUpdate[] = [];
    subscribeAssistantSpeaking(assistant, (u) => {
      updates.push(u);
    });
    const tree = defineDialogueTree({
      start: {
        fork: ['Find the fork.'],
      },
    });
    const renderer = createAssistantDialogueTreeRenderer({
      getAssistant: () => assistant,
      tree,
      clock: createFakeClock(),
      contextFromAction: () => ({}),
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'ref',
      dialogueKey: { bucket: 'start', theme: 'fork' },
      tags: [],
      ttlMs: 1,
    });
    expect(updates).toEqual([
      { message: 'Find the fork.', bubbleResolving: false },
    ]);
  });

  it('plays sequence steps with hold delays', () => {
    const assistant = {} as Assistant<unknown>;
    const messages: (string | null)[] = [];
    subscribeAssistantSpeaking(assistant, (u) => {
      messages.push(u.message);
    });
    const clock = createFakeClock();
    const tree = defineDialogueTree({
      wrong: {
        fork: {
          kind: 'sequence',
          steps: [
            { text: 'Not quite.', holdMs: 1000 },
            { text: 'Look again.', holdMs: 500 },
          ],
        },
      },
    });
    const renderer = createAssistantDialogueTreeRenderer({
      getAssistant: () => assistant,
      tree,
      clock,
      contextFromAction: () => ({}),
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.encourage,
      payloadRef: 'ref',
      dialogueKey: { bucket: 'wrong', theme: 'fork' },
      tags: [],
      ttlMs: 1,
    });
    expect(messages).toEqual(['Not quite.']);
    clock.advance(1000);
    expect(messages).toEqual(['Not quite.', 'Look again.']);
  });

  it('cancels pending sequence when a new speak arrives', () => {
    const assistant = {} as Assistant<unknown>;
    const messages: (string | null)[] = [];
    subscribeAssistantSpeaking(assistant, (u) => {
      messages.push(u.message);
    });
    const clock = createFakeClock();
    const tree = defineDialogueTree({
      wrong: {
        fork: {
          kind: 'sequence',
          steps: [
            { text: 'A', holdMs: 1000 },
            { text: 'B', holdMs: 1000 },
          ],
        },
      },
      start: {
        pin: ['Pin it.'],
      },
    });
    const renderer = createAssistantDialogueTreeRenderer({
      getAssistant: () => assistant,
      tree,
      clock,
      contextFromAction: () => ({}),
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.encourage,
      payloadRef: 'ref',
      dialogueKey: { bucket: 'wrong', theme: 'fork' },
      tags: [],
      ttlMs: 1,
    });
    renderer.render({
      kind: 'speak',
      intent: INTENT.nudge,
      payloadRef: 'ref2',
      dialogueKey: { bucket: 'start', theme: 'pin' },
      tags: [],
      ttlMs: 1,
    });
    clock.advance(2000);
    expect(messages).toEqual(['A', 'Pin it.']);
  });

  it('silence clears the bubble', () => {
    const assistant = {} as Assistant<unknown>;
    let last: string | null | undefined = 'x';
    subscribeAssistantSpeaking(assistant, (u) => {
      last = u.message;
    });
    const renderer = createAssistantDialogueTreeRenderer({
      getAssistant: () => assistant,
      tree: defineDialogueTree({}),
      clock: createFakeClock(),
      contextFromAction: () => ({}),
    });
    renderer.render({ kind: 'silence', reason: 'budget', ttlMs: 1 });
    expect(last).toBeNull();
  });
});
