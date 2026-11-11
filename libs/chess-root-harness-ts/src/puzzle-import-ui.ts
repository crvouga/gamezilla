import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness-ts/chess-puzzle-data';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { importFixture } from './puzzle-import-fixtures';
import {
  type LoaderRunner,
  openLoaderPlace,
  showLoaderPlace,
} from './puzzle-loader-places';
import {
  onlyUseSavedPuzzleSource,
  saveLichessFile,
  seedSavedLichessFile,
  surveyPuzzleSource,
} from './puzzle-source-ui';

export const followPuzzleImport = scenarioAction({
  name: 'followPuzzleImport',
  act: async (s, actor: string) => {
    await actorUi(s, actor);
    const handle = s.actors.get(actor);
    if (!handle) throw new Error('Actor missing');
    await handle.openLink('/more/puzzles');
    await s.session.waitForIdle();
    await handle.ui.get('puzzle-load-content').expect.visible();
  },
});

export const chooseBrokenUpdates = scenarioAction({
  name: 'chooseBrokenUpdates',
  act: (s) => Promise.resolve(seedSavedLichessFile.act(s, true)),
});

export const startPuzzleLoading = scenarioAction({
  name: 'startPuzzleLoading',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    // The denial surface, or a file still being saved, is the outcome.
    if (!(await showLoaderPlace(s, actor, 'load'))) return;
    const start = ui.get('puzzle-load-start');
    // While puzzles are being added the hub's one command is Stop.
    if (!(await start.isVisible())) return;
    if (await ui.get('puzzle-load-offline').isVisible()) return;
    await pollUntil(
      s,
      async () => {
        const source = await surveyPuzzleSource(s, actor);
        return source.saved || source.needsFile ? true : null;
      },
      { maxMs: 15000, description: 'saved file ready' }
    );
    if (!(await surveyPuzzleSource(s, actor)).saved) {
      if (onlyUseSavedPuzzleSource(s)) return;
      await Promise.resolve(saveLichessFile.act(s, actor));
    }
    await pollUntil(
      s,
      async () =>
        (await showLoaderPlace(s, actor, 'load')) &&
        (await start.isVisible()) &&
        (await start.attribute('disabled')) === null
          ? true
          : null,
      { maxMs: 15_000, description: 'puzzle import start enabled' }
    );
    await start.tap();
    await pollUntil(
      s,
      async () =>
        (await ui.get('puzzle-load-status').isVisible()) &&
        (await ui.get('puzzle-load-status').text())?.includes('Adding puzzles')
          ? true
          : null,
      { maxMs: 15_000, description: 'puzzle import accepted' }
    );
  },
});

export const stopPuzzleLoading = scenarioAction({
  name: 'stopPuzzleLoading',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    if (!(await showLoaderPlace(s, actor, 'load'))) return;
    const stop = ui.get('puzzle-load-stop');
    if (
      !(await stop.isVisible()) ||
      (await ui.get('puzzle-load-offline').isVisible())
    )
      return;
    await stop.tap();
    await ui.get('puzzle-load-stop-confirm').tap();
    await pollUntil(
      s,
      async () =>
        (await ui.get('puzzle-load-status').isVisible()) &&
        (await ui.get('puzzle-load-status').text())?.includes('Stopped')
          ? true
          : null,
      { maxMs: 15_000, description: 'puzzle import stopped' }
    );
    await ui.key('escape');
  },
});

const STATUS_WORDS: Readonly<Record<string, string>> = {
  'Adding puzzles': 'adding',
  Finished: 'finished',
  Failed: 'failed',
  Stopped: 'stopped',
};

/**
 * What the loader's hub says: the latest load, the pool and its one
 * command. It never navigates: away from the hub (on the Lichess file's
 * place, for a person outside the team, or while the file is being saved)
 * the hub's controls read as not shown. `inspectPuzzleImport` opens the hub
 * first.
 */
export async function readPuzzleImport(s: ProductHarness, actor = 'alice') {
  const ui = await actorUi(s, actor);
  const read = async (name: string) =>
    (await ui.get(name).isVisible()) ? await ui.get(name).text() : null;
  const enabled = async (name: string) =>
    (await ui.get(name).isVisible()) &&
    (await ui.get(name).attribute('disabled')) === null;
  const text = (await read('puzzle-load-status')) ?? 'Ready';
  const number = async (name: string) =>
    Number(((await read(name)) ?? '0').match(/\d+/)?.[0] ?? 0);
  const startShown = await ui.get('puzzle-load-start').isVisible();
  const stopOffered = await ui.get('puzzle-load-stop').isVisible();
  return {
    status: STATUS_WORDS[text.trim()] ?? 'ready',
    added: await number('puzzle-load-added'),
    updated: await number('puzzle-load-updated'),
    broken: await number('puzzle-load-broken'),
    poolSize: await number('puzzle-load-pool'),
    error: await read('puzzle-load-error'),
    stopOffered,
    stopDisabled: stopOffered && !(await enabled('puzzle-load-stop')),
    offline: await ui.get('puzzle-load-offline').isVisible(),
    startOffered: await enabled('puzzle-load-start'),
    startDisabled: startShown && !(await enabled('puzzle-load-start')),
    denied: await ui.get('permission-denial').isVisible(),
    denialText: await read('permission-denial'),
  };
}

/** The hub, opened first with an action, for a step or a model binding. */
export async function inspectPuzzleImport(run: LoaderRunner, actor = 'alice') {
  await run.apply(openLoaderPlace, actor, 'load');
  return run.read(readPuzzleImport, actor);
}

/** Poll the hub, opened first with an action, until `options.pred` holds. */
export async function untilPuzzleImport(
  run: Pick<OpenHarness, 'apply' | 'until'>,
  actor: string,
  options: {
    pred: (view: Awaited<ReturnType<typeof readPuzzleImport>>) => boolean;
    maxMs: number;
  }
) {
  await run.apply(openLoaderPlace, actor, 'load');
  return run.until((s) => readPuzzleImport(s, actor), options);
}

export const seedPuzzleRefreshPool = scenarioAction({
  name: 'seedPuzzleRefreshPool',
  act: async (s) => {
    await Promise.resolve(
      ingestChessPuzzleCsv.act(
        s,
        `${importFixture(0).split('\n').slice(0, 4).join('\n')}\n`
      )
    );
  },
});

export async function readEnvironmentPuzzleImport(s: ProductHarness) {
  const alice = await readPuzzleImport(s, 'alice');
  return alice.denied && s.actors.has('bob')
    ? readPuzzleImport(s, 'bob')
    : alice;
}
