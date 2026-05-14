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

type StepPayload = { readonly step: number };

describe('createAssistant', () => {
  test('same seed + same signals → identical speak refs', () => {
    let now = 1_000_000;
    const clock = { now: () => now };
    const adapter: GameAdapter<StepPayload> = {
      proposeCandidates() {
        return [
          defineCandidate({
            intent: INTENT.praise,
            weight: 2,
            cost: 5,
            cooldownMs: 0,
            payloadRef: 'x',
            tags: [],
          }),
          defineCandidate({
            intent: INTENT.praise,
            weight: 1,
            cost: 5,
            cooldownMs: 0,
            payloadRef: 'y',
            tags: [],
          }),
        ];
      },
    };
    const run = (): string[] => {
      const a = createAssistant({
        adapter,
        clock,
        seed: 'fixture-seed-deterministic',
        renderer: noopRenderer,
      });
      const out: string[] = [];
      for (let i = 0; i < 12; i += 1) {
        now += 8000;
        const r = a.observe(
          defineSignal({
            kind: 'test.step',
            tags: ['progress'],
            payload: { step: i },
          })
        );
        if (r.kind === 'speak') out.push(r.payloadRef);
      }
      return out;
    };
    expect(run()).toEqual(run());
  });

  test('snapshot restore continues identical picks', () => {
    let now = 5_000_000;
    const clock = { now: () => now };
    const adapter: GameAdapter<StepPayload> = {
      proposeCandidates() {
        return [
          defineCandidate({
            intent: INTENT.praise,
            weight: 1,
            cost: 4,
            cooldownMs: 0,
            payloadRef: 'p1',
            tags: [],
          }),
          defineCandidate({
            intent: INTENT.praise,
            weight: 1,
            cost: 4,
            cooldownMs: 0,
            payloadRef: 'p2',
            tags: [],
          }),
        ];
      },
    };
    const mk = (): ReturnType<typeof createAssistant<StepPayload>> =>
      createAssistant({
        adapter,
        clock,
        seed: 'snap-restore',
        renderer: noopRenderer,
      });
    const first = mk();
    now += 10_000;
    const r0 = first.observe(
      defineSignal({ kind: 'a', tags: ['start'], payload: { step: 0 } })
    );
    now += 10_000;
    const r1a = first.observe(
      defineSignal({ kind: 'a', tags: ['progress'], payload: { step: 1 } })
    );
    const snap = first.snapshot();
    const second = createAssistant({
      adapter,
      clock,
      seed: 'snap-restore',
      renderer: noopRenderer,
      restoreFrom: snap,
    });
    now += 10_000;
    const r1b = second.observe(
      defineSignal({ kind: 'a', tags: ['progress'], payload: { step: 1 } })
    );
    expect(
      r0.kind === 'speak' && r1a.kind === 'speak' && r1b.kind === 'speak'
    ).toBe(true);
    if (r1a.kind === 'speak' && r1b.kind === 'speak') {
      expect(r1b.payloadRef).toBe(r1a.payloadRef);
    }
  });
});
