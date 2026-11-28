import { expect } from 'bun:test';
import { readGameSessionRefusal } from '@libs/game-session-harness-ts/game-session-screen';
import { Then } from '@libs/harness-ts/define';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';

function refusal(reason: string) {
  return async (w: HarnessWorld, actor: string): Promise<void> => {
    expect(await w.s.read(readGameSessionRefusal, actor)).toBe(reason);
  };
}

Then(
  '{actor} is told the game session has already started',
  refusal('already started')
);
Then('{actor} is told the move is illegal', refusal('move is illegal'));
