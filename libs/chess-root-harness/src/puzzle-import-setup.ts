import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import {
  followPuzzleImport,
  readPuzzleImport,
  startPuzzleLoading,
} from './puzzle-import-ui';
import { joinPuzzleTeam } from './puzzle-import-world';

export const preparePuzzleImport = scenarioAction({
  name: 'preparePuzzleImport',
  act: async (s) => {
    let actor = 'alice';
    if ((await readPuzzleImport(s, actor)).denied) {
      actor = 'bob';
      await Promise.resolve(signInWithGoogle.act(s, actor));
      await Promise.resolve(joinPuzzleTeam.act(s, actor));
      await Promise.resolve(followPuzzleImport.act(s, actor));
      await pollUntil(
        s,
        async () => (!(await readPuzzleImport(s, actor)).denied ? true : null),
        { maxMs: 15000, description: 'fixture puzzle manager' }
      );
    }
    await Promise.resolve(startPuzzleLoading.act(s, actor));
    await actorUi(s, 'alice');
  },
});
