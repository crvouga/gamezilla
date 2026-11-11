import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  NO_STAGE_OVERLAY,
  type StageOverlay,
  type StageOverlayEvent,
  type StageOverlayPhase,
  stageOverlayAfter,
  stageOverlayOpening,
  stageOverlayOver,
  stageOverlayPhaseEvent,
  VERSUS_COUNT,
} from '@pkgs/turn-game-client-ts/stage-overlay';
import fc from 'fast-check';

const event = fc.constantFrom<StageOverlayEvent>(
  { type: 'began' },
  { type: 'tick' },
  { type: 'skip' },
  { type: 'ended' },
  { type: 'dismiss' },
  { type: 'show' },
  { type: 'reset' }
);
const events = fc.array(event, { maxLength: 40 });
const phase = fc.constantFrom<StageOverlayPhase>(
  'unknown',
  'setup',
  'play',
  'over'
);

function run(
  start: StageOverlay,
  steps: readonly StageOverlayEvent[]
): StageOverlay[] {
  const seen = [start];
  for (const step of steps)
    seen.push(stageOverlayAfter(seen[seen.length - 1] ?? start, step));
  return seen;
}

function last(states: readonly StageOverlay[]): StageOverlay {
  return states[states.length - 1] ?? NO_STAGE_OVERLAY;
}

describe('stage overlay machine', () => {
  test('a versus count is always a whole second from 1 to the start count', () => {
    assertProperty(
      'versus count stays in range',
      fc.property(events, (steps) => {
        for (const state of run(NO_STAGE_OVERLAY, steps))
          if (state.kind === 'versus') {
            expect(Number.isInteger(state.count)).toBe(true);
            expect(state.count).toBeGreaterThanOrEqual(1);
            expect(state.count).toBeLessThanOrEqual(VERSUS_COUNT);
          }
      })
    );
  });

  test('the versus card always clears: the count ticks reach the board and stay there', () => {
    assertProperty(
      'versus always clears',
      fc.property(events, (steps) => {
        const ticks = Array.from({ length: VERSUS_COUNT }, () => ({
          type: 'tick' as const,
        }));
        const before = last(run(NO_STAGE_OVERLAY, steps));
        const after = last(run(before, ticks));
        expect(after.kind).not.toBe('versus');
        // Ticks alone never bring a card: a late timer does no harm.
        expect(last(run(after, ticks))).toEqual(after);
        if (before.kind !== 'versus') expect(after).toEqual(before);
      })
    );
  });

  test('a press on the versus card shows the board at once', () => {
    assertProperty(
      'skip shows the board',
      fc.property(events, (steps) => {
        const before = last(run(NO_STAGE_OVERLAY, steps));
        const after = stageOverlayAfter(before, { type: 'skip' });
        expect(after).toEqual(
          before.kind === 'versus' ? NO_STAGE_OVERLAY : before
        );
      })
    );
  });

  test('the result card only follows the end of a game, and only closing it hides it while the game stays over', () => {
    assertProperty(
      'result follows the end',
      fc.property(events, (steps) => {
        const seen = run(NO_STAGE_OVERLAY, steps);
        steps.forEach((step, index) => {
          const from = seen[index] ?? NO_STAGE_OVERLAY;
          const to = seen[index + 1] ?? NO_STAGE_OVERLAY;
          if (to.kind === 'outcome' && from.kind !== 'outcome')
            expect(['ended', 'show']).toContain(step.type);
          if (from.kind === 'outcome' && to.kind !== 'outcome')
            expect(['dismiss', 'reset', 'began']).toContain(step.type);
          if (to.kind === 'board') expect(stageOverlayOver(from)).toBe(true);
        });
      })
    );
  });

  test('closing and reopening the result card are each other’s way back', () => {
    const closed = stageOverlayAfter({ kind: 'outcome' }, { type: 'dismiss' });
    expect(closed).toEqual({ kind: 'board' });
    expect(stageOverlayAfter(closed, { type: 'show' })).toEqual({
      kind: 'outcome',
    });
  });

  test('a reset always leaves a bare board', () => {
    assertProperty(
      'reset bares the board',
      fc.property(events, (steps) => {
        const before = last(run(NO_STAGE_OVERLAY, steps));
        expect(stageOverlayAfter(before, { type: 'reset' })).toEqual(
          NO_STAGE_OVERLAY
        );
      })
    );
  });
});

describe('stage overlay and the game’s phase', () => {
  test('a game opened already over shows its result; any other opens on its board', () => {
    expect(stageOverlayOpening('over')).toEqual({ kind: 'outcome' });
    expect(stageOverlayOpening('play')).toEqual(NO_STAGE_OVERLAY);
    expect(stageOverlayOpening('setup')).toEqual(NO_STAGE_OVERLAY);
    expect(stageOverlayOpening('unknown')).toEqual(NO_STAGE_OVERLAY);
  });

  test('only a game watched leaving its setup plays the versus card', () => {
    expect(stageOverlayPhaseEvent('setup', 'play')).toEqual({ type: 'began' });
    expect(stageOverlayPhaseEvent('over', 'play')).toEqual({ type: 'began' });
    // A game read late and found in play was never watched begin.
    expect(stageOverlayPhaseEvent('unknown', 'play')).toBeNull();
  });

  test('watching any walk of phases: over means a result is reachable, play never shows one, setup shows nothing', () => {
    assertProperty(
      'phases agree with the overlay',
      fc.property(phase, fc.array(phase, { maxLength: 20 }), (first, walk) => {
        let at = first;
        let state = stageOverlayOpening(first);
        for (const next of walk) {
          const step = stageOverlayPhaseEvent(at, next);
          if (step !== null) state = stageOverlayAfter(state, step);
          at = next;
          if (at === 'over') expect(state.kind).toBe('outcome');
          if (at === 'play') expect(stageOverlayOver(state)).toBe(false);
          if (at === 'setup' || at === 'unknown')
            expect(state).toEqual(NO_STAGE_OVERLAY);
        }
      })
    );
  });

  test('the same phase again is no event', () => {
    assertProperty(
      'same phase is no event',
      fc.property(phase, (same) => {
        expect(stageOverlayPhaseEvent(same, same)).toBeNull();
      })
    );
  });
});
