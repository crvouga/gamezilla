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

describe('player model via tags', () => {
  test('wrong tags increase frustration weighting path', () => {
    let now = 0;
    const clock = { now: () => now };
    const adapter: GameAdapter<{ n: number }> = {
      proposeCandidates(_sig, player) {
        const w = 1 + player.frustration() * 100;
        return [
          defineCandidate({
            intent: INTENT.encourage,
            weight: w,
            cost: 1,
            cooldownMs: 0,
            payloadRef: 'line',
            tags: [],
          }),
        ];
      },
    };
    const a = createAssistant({
      adapter,
      clock,
      seed: 'frustration',
      renderer: noopRenderer,
    });
    now += 1;
    a.observe(defineSignal({ kind: 'x', tags: ['wrong'], payload: { n: 1 } }));
    now += 50_000;
    const r = a.observe(
      defineSignal({ kind: 'x', tags: ['wrong'], payload: { n: 2 } })
    );
    expect(r.kind).toBe('speak');
  });
});
