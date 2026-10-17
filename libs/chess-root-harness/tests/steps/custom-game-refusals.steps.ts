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
    // Both gates describe the same business denial without prescribing copy.
    expect(actual).toBeOneOf(
      reason.startsWith('only the creator')
        ? [reason, 'only the creator']
        : [reason]
    );
  };
}

Then(
  '{actor} is told Custom Games need a connection',
  refusal('connection needed')
);
Then(
  '{actor} is told only the creator configures the Custom Game',
  refusal('only the creator configures the Custom Game')
);
Then(
  '{actor} is told the Custom Game choices have changed',
  refusal('choices changed')
);
Then(
  '{actor} is told the Custom Game has already started',
  refusal('already started')
);
Then('{actor} is told the move is illegal', refusal('move is illegal'));
Then('{actor} is told they are not in the space', refusal('not in the space'));
Then('{actor} is told {actor} cannot be invited', refusal('cannot be invited'));
Then(
  '{actor} is told that side is not available to him',
  refusal('side not available')
);
