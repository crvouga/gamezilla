import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { importFixture } from './puzzle-import-fixtures';
import { readPuzzleSource } from './puzzle-source-ui';

export const LICHESS_SOURCE_PATH = '/api/puzzle-management/source';

export const leavePuzzleLoading = scenarioAction({
  name: 'leavePuzzleLoading',
  act: async (s, actor: string = 'alice') => {
    await actorUi(s, actor);
    await s.actors.get(actor)?.openLink('/more');
    await s.session.waitForIdle();
  },
});

export const controlLichessFileCheck = scenarioAction({
  name: 'controlLichessFileCheck',
  act: async (s, outcome: 'hold' | 'fail' | null, actor: string = 'alice') => {
    s.harness.loadBalancer.requests.set(
      actor,
      'GET',
      LICHESS_SOURCE_PATH,
      outcome
    );
  },
});

export const reopenLichessFile = scenarioAction({
  name: 'reopenLichessFile',
  act: async (s, actor: string = 'alice') => {
    await Promise.resolve(leavePuzzleLoading.act(s, actor));
    await s.actors.get(actor)?.openLink('/more/puzzles');
    await s.session.waitForIdle();
  },
});

export const checkLichessFileAgain = scenarioAction({
  name: 'checkLichessFileAgain',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    if (await ui.get('puzzle-source-recheck').isVisible())
      await ui.get('puzzle-source-recheck').tap();
    else await Promise.resolve(reopenLichessFile.act(s, actor));
    await s.session.waitForIdle();
  },
});

export const chooseLichessFile = scenarioAction({
  name: 'chooseLichessFile',
  act: async (s, invalid: boolean = false, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    await ui.get('puzzle-load-file').selectFile({
      name: 'alice-lichess.csv',
      bytes: [
        ...new TextEncoder().encode(
          invalid ? 'This is not a puzzle file.' : importFixture(2)
        ),
      ],
    });
  },
});

export const saveChosenLichessFile = scenarioAction({
  name: 'saveChosenLichessFile',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    if (await ui.get('puzzle-source-save').isVisible())
      await ui.get('puzzle-source-save').tap();
    await s.session.waitForIdle();
  },
});

export const controlLichessFileSave = scenarioAction({
  name: 'controlLichessFileSave',
  act: async (s, outcome: 'hold' | 'fail' | null, actor: string = 'alice') => {
    s.harness.loadBalancer.requests.set(
      actor,
      'POST',
      LICHESS_SOURCE_PATH,
      outcome
    );
  },
});

export const finishSavingChosenLichessFile = scenarioAction({
  name: 'finishSavingChosenLichessFile',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    if (!(await ui.get('puzzle-source-save').isVisible())) return;
    if ((await readPuzzleSource(s, actor)).offline) return;
    await Promise.resolve(saveChosenLichessFile.act(s, actor));
    await pollUntil(
      s,
      async () => {
        const source = await readPuzzleSource(s, actor);
        return source.saved || source.saveFailed ? true : null;
      },
      { maxMs: 15000, description: 'chosen Lichess file save outcome' }
    );
  },
});

export async function readStopPuzzleChoice(
  s: ProductHarness,
  actor: string = 'alice'
) {
  const ui = await actorUi(s, actor);
  const visible = await ui.get('puzzle-load-stop-modal').isVisible();
  const text = visible
    ? ((await ui.get('puzzle-load-stop-modal').text()) ?? '')
    : '';
  const submit = ui.get('puzzle-load-stop-confirm');
  return {
    visible,
    confirming:
      (await submit.isVisible()) && !text.includes('Something went wrong'),
    confirmEnabled:
      (await submit.isVisible()) &&
      (await submit.attribute('disabled')) === null,
    stopping: visible && text.includes('Working'),
    failed: visible && text.includes('Something went wrong'),
    succeeded: await ui.get('puzzle-load-stop-success').isVisible(),
    text,
  };
}

export const askToStopPuzzleLoading = scenarioAction({
  name: 'askToStopPuzzleLoading',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    if (await ui.get('puzzle-load-stop').isVisible())
      await ui.get('puzzle-load-stop').tap();
  },
});

export const cancelStoppingPuzzleLoading = scenarioAction({
  name: 'cancelStoppingPuzzleLoading',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    await ui.key('escape');
  },
});

export const confirmStoppingPuzzleLoading = scenarioAction({
  name: 'confirmStoppingPuzzleLoading',
  act: async (s, actor: string = 'alice') => {
    const ui = await actorUi(s, actor);
    if (await ui.get('puzzle-load-stop-confirm').isVisible())
      await ui.get('puzzle-load-stop-confirm').tap();
    await s.session.waitForIdle();
  },
});

export const controlStoppingPuzzleLoading = scenarioAction({
  name: 'controlStoppingPuzzleLoading',
  act: async (s, outcome: 'hold' | 'fail' | null, actor: string = 'alice') => {
    s.harness.loadBalancer.requests.set(
      actor,
      'POST',
      '/api/mutations',
      outcome
    );
  },
});
