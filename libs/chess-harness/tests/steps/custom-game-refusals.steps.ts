import { expect } from 'bun:test';
import { readCustomGameBoundary } from '@libs/chess-custom-game-harness/custom-game-boundary';
import { readCustomGameProbe } from '@libs/chess-custom-game-harness/custom-game-ui';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { Then } from '@libs/harness/define';

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
  '{actor} is told a person cannot take both sides',
  refusal('one side per person')
);
Then(
  '{actor} is told both sides need participants',
  refusal('both sides need participants')
);
Then(
  '{actor} is told draw agreement needs two people',
  refusal('draw agreement needs two people')
);
Then(
  '{actor} is told every person must be ready',
  refusal('every person must be ready')
);
Then(
  '{actor} is told only a participant may become ready',
  refusal('not a participant')
);
Then(
  '{actor} is told only a participant may resign',
  refusal('not a participant')
);
Then(
  '{actor} is told only that participant may release the side',
  refusal('not your side')
);
Then(
  '{actor} is told only the creator cancels the Custom Game',
  refusal('only the creator cancels the Custom Game')
);
Then(
  '{actor} is told only the creator configures the Custom Game',
  refusal('only the creator configures the Custom Game')
);
Then(
  '{actor} is told only the creator starts the Custom Game',
  refusal('only the creator starts the Custom Game')
);
Then(
  '{actor} is told only the other participant may accept a draw',
  refusal('not the other participant')
);
Then(
  '{actor} is told only the other participant may decline a draw',
  refusal('not the other participant')
);
Then(
  '{actor} is told only the participant to move may play',
  refusal('only the participant to move may play')
);
Then(
  '{actor} is told that move is not in the Custom Game',
  refusal('no such move')
);
Then(
  '{actor} is told that side is not an open place',
  refusal('not an open place')
);
Then(
  '{actor} is told that side is not their invitation',
  refusal('not your invitation')
);
Then(
  '{actor} is told the Custom Game choices have changed',
  refusal('choices changed')
);
Then(
  '{actor} is told the Custom Game has already started',
  refusal('already started')
);
Then('{actor} is told the Custom Game has finished', refusal('finished'));
Then('{actor} is told the Custom Game has not started', refusal('not started'));
Then('{actor} is told the Custom Game was cancelled', refusal('cancelled'));
Then('{actor} is told the move is illegal', refusal('move is illegal'));
Then(
  '{actor} is told the person must be in the space',
  refusal('person not in the space')
);
Then(
  '{actor} is told the time choice is outside the Custom Game limits',
  refusal('invalid time choice')
);
Then('{actor} is told they are not in the space', refusal('not in the space'));
