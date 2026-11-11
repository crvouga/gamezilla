import { puzzleCsvParts } from '@libs/chess-puzzle-client-ts/puzzle-csv-parts';
import { puzzleSourcePartKey } from '@libs/chess-puzzle-shared-ts/puzzle-load-job';
import { SAVED_PUZZLE_SOURCE_KEY } from '@libs/chess-puzzle-shared-ts/puzzle-source';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { importFixture } from './puzzle-import-fixtures';
import {
  type LoaderRunner,
  openLoaderPlace,
  showLoaderPlace,
} from './puzzle-loader-places';

const reuseOnly = new WeakSet<ProductHarness>();
export function onlyUseSavedPuzzleSource(s: ProductHarness) {
  return reuseOnly.has(s);
}

/**
 * What the place shown says about the Lichess file. The file's controls are
 * on the `source` place and adding puzzles is the hub's command: a control
 * of the place not shown reads as not shown, which is what the person
 * sees. It never navigates; `inspectPuzzleSource` reads both places.
 */
export async function readPuzzleSource(s: ProductHarness, actor = 'alice') {
  const ui = await actorUi(s, actor);
  const shown = (name: string) => ui.get(name).isVisible();
  const enabled = async (name: string) =>
    (await shown(name)) && (await ui.get(name).attribute('disabled')) === null;
  const saved = await shown('puzzle-source-saved');
  return {
    saved,
    chosen: await shown('puzzle-source-chosen'),
    filename: saved ? await ui.get('puzzle-source-saved').text() : null,
    checking: await shown('puzzle-source-checking'),
    checkOffline: await shown('puzzle-source-check-offline'),
    checkFailed: await shown('puzzle-source-error'),
    checkAgainOffered: await shown('puzzle-source-recheck'),
    checkAgainEnabled: await enabled('puzzle-source-recheck'),
    saving: await shown('puzzle-source-saving'),
    progressVisible: await shown('puzzle-source-progress'),
    saveFailed: await shown('puzzle-source-save-error'),
    saveError: (await shown('puzzle-source-save-error'))
      ? await ui.get('puzzle-source-save-error').text()
      : null,
    saveEnabled: await enabled('puzzle-source-save'),
    chooseEnabled:
      (await shown('puzzle-load-file')) &&
      (await ui.get('puzzle-load-file').attribute('aria-disabled')) !== 'true',
    needsFile: await shown('puzzle-source-missing'),
    saveOffered: await shown('puzzle-source-save'),
    // The hub offers adding puzzles only from a saved file.
    startOffered: await enabled('puzzle-load-start'),
    offline: await shown('puzzle-load-offline'),
    offlineMessage: (await shown('puzzle-load-offline'))
      ? await ui.get('puzzle-load-offline').text()
      : null,
  };
}

/**
 * Both places of the loader, as an action looks them over: the Lichess
 * file's own place first, then the hub, where it ends. A place a dialog
 * covers or the stage does not show cannot be opened; its controls read as
 * not shown.
 */
export async function surveyPuzzleSource(s: ProductHarness, actor = 'alice') {
  await showLoaderPlace(s, actor, 'source');
  const source = await readPuzzleSource(s, actor);
  await showLoaderPlace(s, actor, 'load');
  const hub = await readPuzzleSource(s, actor);
  return { ...source, startOffered: hub.startOffered };
}

/**
 * The same look over both places for a step or a model binding: it opens
 * each place with an action and reads it, so no read navigates.
 */
export async function inspectPuzzleSource(run: LoaderRunner, actor = 'alice') {
  await run.apply(openLoaderPlace, actor, 'source');
  const source = await run.read(readPuzzleSource, actor);
  await run.apply(openLoaderPlace, actor, 'load');
  const hub = await run.read(readPuzzleSource, actor);
  return { ...source, startOffered: hub.startOffered };
}

export async function reloadPuzzleSource(s: ProductHarness, actor = 'alice') {
  const person = s.actors.get(actor);
  if (!person) throw new Error('Actor missing');
  await person.openLink('/more');
  await person.openLink('/more/puzzles');
  await pollUntil(
    s,
    async () => {
      const source = await surveyPuzzleSource(s, actor);
      return source.saved || source.needsFile || source.offline ? true : null;
    },
    { maxMs: 15000, description: 'shared Lichess file availability' }
  );
}

export const saveLichessFile = scenarioAction({
  name: 'saveLichessFile',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    const view = await pollUntil(
      s,
      async () => {
        const source = await surveyPuzzleSource(s, actor);
        return source.saved || source.offline || source.saveOffered
          ? source
          : null;
      },
      { maxMs: 15000, description: 'Lichess file availability before saving' }
    );
    if (view.saved || view.offline) return;
    await showLoaderPlace(s, actor, 'source');
    await ui.get('puzzle-load-file').selectFile({
      name: 'lichess.csv',
      bytes: [...new TextEncoder().encode(importFixture(1))],
    });
    await ui.get('puzzle-source-save').tap();
    await pollUntil(
      s,
      async () => ((await surveyPuzzleSource(s, actor)).saved ? true : null),
      { maxMs: 15000, description: 'Lichess file saved' }
    );
  },
});

export const noSavedLichessFile = scenarioAction({
  name: 'noSavedLichessFile',
  act: async (s) => {
    reuseOnly.add(s);
    await s.harness.server.blob.delete(SAVED_PUZZLE_SOURCE_KEY);
    await reloadPuzzleSource(s);
  },
});

export const reuseLichessFile = scenarioAction({
  name: 'reuseLichessFile',
  act: async (s) => {
    reuseOnly.add(s);
    await reloadPuzzleSource(s);
  },
});

/** Fixture input, not a second implementation of publishing or importing. */
export const seedSavedLichessFile = scenarioAction({
  name: 'seedSavedLichessFile',
  act: async (s, broken: boolean = false) => {
    reuseOnly.add(s);
    const id = broken ? 'saved-broken-puzzles' : 'saved-puzzles';
    let chunks = 0;
    for await (const part of puzzleCsvParts(
      new Blob([importFixture(1, broken)]).stream()
    )) {
      await writeUtf8(
        s.harness.server.blob,
        puzzleSourcePartKey(id, chunks++),
        part.csv,
        'text/csv'
      );
    }
    await writeUtf8(
      s.harness.server.blob,
      SAVED_PUZZLE_SOURCE_KEY,
      JSON.stringify({ id, filename: 'lichess.csv', chunks }),
      'application/json'
    );
    await reloadPuzzleSource(s);
  },
});
