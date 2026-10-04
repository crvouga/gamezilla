import { finishCompetingPuzzleResults } from '@libs/chess-puzzle-harness/puzzle-competing-mates';
import type { Actor } from '@libs/harness/parameter-types';
import { Given, When } from '@libs/harness/define';
import type { PuzzleFinishName } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';

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
