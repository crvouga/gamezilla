import { expect, test } from 'bun:test';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { leaveSpace } from '@libs/spaces-harness-ts/space-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

// regression: game-result-covers-departing-participant
test.each(['already visible', 'arrives at Leave'])(
  'Bob closes the game result (%s) and confirms leaving before the rematch',
  async (arrival) => {
    let result = arrival === 'already visible';
    let closed = false;
    let prompt = false;
    let left = false;
    const taps: string[] = [];
    const ui = {
      get: (id: string) => ({
        isVisible: async () =>
          (id === 'game-result-close' && result) ||
          (id === Handles.spaceMutationDismiss && left),
        tap: async () => {
          if (id === Handles.spaceLeave && !closed) result = true;
          if (result && id !== 'game-result-close')
            throw new Error('GameResultDialog covers space-leave');
          taps.push(id);
          if (id === 'game-result-close') {
            result = false;
            closed = true;
          }
          if (id === Handles.spaceLeave) prompt = true;
          if (id === Handles.spaceLeaveConfirm && prompt) {
            prompt = false;
            left = true;
          }
        },
        expect: {
          hidden: async () => {
            expect(id === 'game-result-close' ? result : prompt).toBe(false);
          },
        },
      }),
    };
    const s = {
      actors: new Map([['bob', { ui }]]),
    } as unknown as ProductHarness;
    await Promise.resolve(leaveSpace.act(s, 'bob'));
    expect(left).toBe(true);
    expect(taps).toEqual([
      'game-result-close',
      Handles.spaceLeave,
      Handles.spaceLeaveConfirm,
      Handles.spaceMutationDismiss,
    ]);
  }
);
