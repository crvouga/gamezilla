import { partition, restoreActorConnection } from '@libs/harness/actions';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { focusActor } from '@libs/harness/shell-actions';
import { reopenSpaceLink } from '@libs/spaces-harness/space-actions';
import { readSpaceLink } from '@libs/spaces-harness/spaces-ui-reads';
import { finishPuzzleBy, playPuzzleMove } from './chess-actions';
import { readActivePuzzleId, readPuzzleDebug } from './chess-puzzle-ui';
import {
  readLocalPuzzleResult,
  readRecordedPuzzleResult,
} from './puzzle-result-recovery';

async function prepareCopies(s: ProductHarness, actor: string, other: string) {
  await Promise.resolve(focusActor.act(s, actor));
  const link = await readSpaceLink(s, actor);
  const puzzle = await readActivePuzzleId(s, actor);
  if (link === null || puzzle === null) throw new Error('No active puzzle');
  await Promise.resolve(reopenSpaceLink.act(s, other, link));
  await pollUntil(
    s,
    async () =>
      (await readActivePuzzleId(s, other)) === puzzle &&
      (await readPuzzleDebug(s, other))?.interactive === true
        ? true
        : null,
    {
      maxMs: 20_000,
      description: 'the other device has the same playable puzzle',
    }
  );
  await Promise.resolve(partition.act(s, actor));
  await Promise.resolve(partition.act(s, other));
  return puzzle;
}

/** Two devices of one solver act on their own cached copies before reconnecting. */
export const deliverCompetingPuzzleMates = scenarioAction({
  name: 'deliverCompetingPuzzleMates',
  act: async (s, actor: string, other: string) => {
    await prepareCopies(s, actor, other);
    await Promise.resolve(focusActor.act(s, actor));
    await Promise.resolve(playPuzzleMove.act(s, actor, 'a7a8'));
    await Promise.resolve(focusActor.act(s, other));
    await Promise.resolve(playPuzzleMove.act(s, other, 'b7b8'));
  },
});

/** Both devices finish apart; the first device's result reaches the account first. */
export const finishCompetingPuzzleResults = scenarioAction({
  name: 'finishCompetingPuzzleResults',
  act: async (
    s,
    args: {
      actor: string;
      other: string;
      first: Parameters<typeof finishPuzzleBy.act>[2];
      second: Parameters<typeof finishPuzzleBy.act>[2];
      reconnectOther: boolean;
    }
  ) => {
    const puzzle = await prepareCopies(s, args.actor, args.other);
    await Promise.resolve(focusActor.act(s, args.actor));
    await Promise.resolve(finishPuzzleBy.act(s, args.actor, args.first));
    await Promise.resolve(focusActor.act(s, args.other));
    await Promise.resolve(finishPuzzleBy.act(s, args.other, args.second));
    await Promise.resolve(restoreActorConnection.act(s, args.actor));
    await pollUntil(
      s,
      async () =>
        (await readRecordedPuzzleResult(s, args.actor, puzzle)) !== 'Unfinished'
          ? true
          : null,
      { maxMs: 30_000, description: 'the first device’s result has counted' }
    );
    if (args.reconnectOther) {
      await Promise.resolve(restoreActorConnection.act(s, args.other));
      await Promise.resolve(focusActor.act(s, args.actor));
      const first = await readRecordedPuzzleResult(s, args.actor, puzzle);
      await Promise.resolve(focusActor.act(s, args.other));
      await pollUntil(
        s,
        async () =>
          (await readLocalPuzzleResult(s, args.other, puzzle)) === first
            ? true
            : null,
        {
          maxMs: 30_000,
          description: 'the returning device has received the first result',
        }
      );
    }
  },
});
