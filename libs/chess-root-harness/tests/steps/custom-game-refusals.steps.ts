import { expect } from 'bun:test';
import { readCustomGameRefusal } from '@libs/game-session-harness/custom-game-screen';
import { Then } from '@libs/harness/define';
import type { HarnessWorld } from '@libs/harness/spec-world';

function refusal(reason: string) {
  return async (w: HarnessWorld, actor: string): Promise<void> => {
    expect(await w.s.read(readCustomGameRefusal, actor)).toBe(reason);
  };
}

Then(
  '{actor} is told the Custom Game has already started',
  refusal('already started')
);
Then('{actor} is told the move is illegal', refusal('move is illegal'));
