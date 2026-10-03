import { finishCompetingPuzzleResults } from '@libs/chess/harness/puzzle-competing-mates';
import { type Actor, Given, When } from '@libs/harness/spec/define';
import type { PuzzleFinishName } from '@libs/harness/spec/parameter-types';
import { otherDevice } from '@libs/harness/spec/steps/platform';

Given(
  "{actor}'s {competingFinish} result reached the account before the other device's {competingFinish} result",
  async (
    w,
    actor: Actor,
    first: PuzzleFinishName,
    second: PuzzleFinishName
  ) => {
    await w.s.apply(finishCompetingPuzzleResults, {
      actor,
      other: otherDevice(actor),
      first,
      second,
      reconnectOther: false,
    });
  }
);

When(
  "{actor}'s attempt finishes on two devices with {competingFinish} reaching the account first",
  async (w, actor: Actor, first: PuzzleFinishName) => {
    await w.s.apply(finishCompetingPuzzleResults, {
      actor,
      other: otherDevice(actor),
      first,
      second: first === 'clean' ? 'wrongRetrySolve' : 'clean',
      reconnectOther: true,
    });
  }
);
