import { expect } from 'bun:test';
import { readCustomGameBoundary } from '@libs/game-session-harness/custom-game-boundary';
import { readCustomGameProbe } from '@libs/game-session-harness/custom-game-ui';
import { Then } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';

function refusal(reason: string) {
  return async (w: HarnessWorld, actor: string): Promise<void> => {
    const actual =
      (await w.s.read(readCustomGameProbe, actor))?.error ??
      (await w.s.read(readCustomGameBoundary, actor))?.reason;
    expect(actual).toBe(reason);
  };
}

Then(
  '{actor} is told the Custom Game has already started',
  refusal('already started')
);
Then('{actor} is told the move is illegal', refusal('move is illegal'));
