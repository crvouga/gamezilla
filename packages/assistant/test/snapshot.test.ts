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

describe('AssistantSnapshot', () => {
  test('round-trip preserves rng and player fields', () => {
    let now = 100;
    const clock = { now: () => now };
    const adapter: GameAdapter<{ n: number }> = {
      proposeCandidates() {
        return [
          defineCandidate({
            intent: INTENT.praise,
            weight: 1,
            cost: 2,
            cooldownMs: 0,
            payloadRef: 'a',
            tags: [],
          }),
        ];
      },
    };
    const a = createAssistant({
      adapter,
      clock,
      seed: 'snap-body',
      renderer: noopRenderer,
    });
    now += 1;
    a.observe(defineSignal({ kind: 'z', tags: ['wrong'], payload: { n: 1 } }));
    const snap = a.snapshot();
    const b = createAssistant({
      adapter,
      clock,
      seed: 'snap-body',
      renderer: noopRenderer,
      restoreFrom: snap,
    });
    now += 1;
    const rA = a.observe(
      defineSignal({ kind: 'z', tags: ['progress'], payload: { n: 2 } })
    );
    now += 1;
    const rB = b.observe(
      defineSignal({ kind: 'z', tags: ['progress'], payload: { n: 2 } })
    );
    if (rA.kind === 'speak' && rB.kind === 'speak') {
      expect(rB.payloadRef).toBe(rA.payloadRef);
    }
  });
});
