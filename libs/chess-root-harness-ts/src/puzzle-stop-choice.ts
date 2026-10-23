import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  askToStopPuzzleLoading,
  confirmStoppingPuzzleLoading,
  controlStoppingPuzzleLoading,
  readStopPuzzleChoice,
} from './lichess-file-actions';
import {
  followPuzzleImport,
  readPuzzleImport,
  startPuzzleLoading,
} from './puzzle-import-ui';
import { advancePuzzleImport, joinPuzzleTeam } from './puzzle-import-world';
import { failStoppingPuzzleLoading } from './puzzle-stop-failure';

export const preparePuzzleStopChoice = scenarioAction({
  name: 'preparePuzzleStopChoice',
  act: async (s, phase: string, existingActor: boolean = false) => {
    if (!existingActor) {
      await Promise.resolve(signInWithGoogle.act(s, 'alice'));
      await Promise.resolve(joinPuzzleTeam.act(s, 'alice'));
    }
    await Promise.resolve(followPuzzleImport.act(s, 'alice'));
    await Promise.resolve(startPuzzleLoading.act(s, 'alice'));
    const ui = await actorUi(s, 'alice');
    await pollUntil(
      s,
      async () =>
        (await ui.get('puzzle-load-start').attribute('data-phase')) !==
        'loading'
          ? true
          : null,
      { maxMs: 15000, description: 'accepted puzzle addition' }
    );
    await Promise.resolve(advancePuzzleImport.act(s));
    if (phase === 'idle') return;
    await Promise.resolve(askToStopPuzzleLoading.act(s));
    if (phase === 'confirming') return;
    await Promise.resolve(controlStoppingPuzzleLoading.act(s, 'hold'));
    await Promise.resolve(confirmStoppingPuzzleLoading.act(s));
    if (phase === 'failed')
      await Promise.resolve(failStoppingPuzzleLoading.act(s));
  },
});

export const followPuzzleStopChoice = scenarioAction({
  name: 'followPuzzleStopChoice',
  act: async (s, actor: string = 'alice') => {
    if ((await readStopPuzzleChoice(s, actor)).succeeded)
      await (await actorUi(s, actor)).key('escape');
    await Promise.resolve(followPuzzleImport.act(s, actor));
  },
});

export async function readPuzzleStopChoice(s: ProductHarness) {
  const choice = await readStopPuzzleChoice(s);
  const addition = await readPuzzleImport(s);
  return {
    stoppingPuzzles: !choice.visible
      ? 'idle'
      : choice.succeeded
        ? 'succeeded'
        : choice.failed
          ? 'failed'
          : choice.stopping
            ? 'stopping'
            : 'confirming',
    addingPuzzlesStatus: addition.status,
    online: !addition.offline,
  };
}
