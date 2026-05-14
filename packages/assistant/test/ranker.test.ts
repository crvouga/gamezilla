import { describe, expect, test } from 'bun:test';

import {
  createAssistant,
  defineCandidate,
  defineSignal,
  INTENT,
  type AssistantRenderer,
  type GameAdapter,
} from '../src/shared';

const noopRenderer: AssistantRenderer = { render(): void {} };

describe('ranker gates', () => {
  test('returns silence when every candidate is over budget', () => {
    let now = 0;
    const clock = { now: () => now };
    const adapter: GameAdapter<{ n: number }> = {
      proposeCandidates() {
        return [
          defineCandidate({
            intent: INTENT.explain,
            weight: 100,
            cost: 500,
            cooldownMs: 0,
            payloadRef: 'expensive',
            tags: [],
          }),
        ];
      },
    };
    const a = createAssistant({
      adapter,
      clock,
      seed: 'budget-test',
      renderer: noopRenderer,
    });
    now += 1;
    const r = a.observe(
      defineSignal({ kind: 'x', tags: ['wrong'], payload: { n: 1 } })
    );
    expect(r).toEqual({
      kind: 'silence',
      reason: 'budget',
      ttlMs: 500,
    });
  });

  test('returns silence when payload cooldown blocks all', () => {
    let now = 0;
    const clock = { now: () => now };
    const adapter: GameAdapter<{ n: number }> = {
      proposeCandidates() {
        return [
          defineCandidate({
            intent: INTENT.praise,
            weight: 10,
            cost: 1,
            cooldownMs: 1_000_000,
            payloadRef: 'only',
            tags: [],
          }),
        ];
      },
    };
    const a = createAssistant({
      adapter,
      clock,
      seed: 'cd-test',
      renderer: noopRenderer,
    });
    now += 1;
    const r0 = a.observe(
      defineSignal({ kind: 'x', tags: ['progress'], payload: { n: 0 } })
    );
    expect(r0.kind).toBe('speak');
    now += 2;
    const r1 = a.observe(
      defineSignal({ kind: 'x', tags: ['progress'], payload: { n: 1 } })
    );
    expect(r1).toEqual({
      kind: 'silence',
      reason: 'cooldown',
      ttlMs: 500,
    });
  });
});
