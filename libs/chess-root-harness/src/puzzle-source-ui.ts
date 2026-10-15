import { puzzleCsvParts } from '@libs/chess-puzzle-client/puzzle-csv-parts';
import { puzzleSourcePartKey } from '@libs/chess-puzzle-shared/puzzle-load-job';
import { SAVED_PUZZLE_SOURCE_KEY } from '@libs/chess-puzzle-shared/puzzle-source';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { writeUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { importFixture } from './puzzle-import-fixtures';

const reuseOnly = new WeakSet<ProductHarness>();
export function onlyUseSavedPuzzleSource(s: ProductHarness) {
  return reuseOnly.has(s);
}

export async function readPuzzleSource(s: ProductHarness, actor = 'alice') {
  const ui = await actorUi(s, actor);
  const saved = await ui.get('puzzle-source-saved').isVisible();
  return {
    saved,
    chosen: await ui.get('puzzle-source-chosen').isVisible(),
    filename: saved ? await ui.get('puzzle-source-saved').text() : null,
    checking: await ui.get('puzzle-source-checking').isVisible(),
    checkOffline: await ui.get('puzzle-source-check-offline').isVisible(),
    checkFailed: await ui.get('puzzle-source-error').isVisible(),
    checkAgainOffered: await ui.get('puzzle-source-recheck').isVisible(),
    checkAgainEnabled:
      (await ui.get('puzzle-source-recheck').isVisible()) &&
      (await ui.get('puzzle-source-recheck').attribute('disabled')) === null,
    saving: await ui.get('puzzle-source-saving').isVisible(),
    saveFailed: await ui.get('puzzle-source-save-error').isVisible(),
    saveError: (await ui.get('puzzle-source-save-error').isVisible())
      ? await ui.get('puzzle-source-save-error').text()
      : null,
    saveEnabled:
      (await ui.get('puzzle-source-save').isVisible()) &&
      (await ui.get('puzzle-source-save').attribute('disabled')) === null,
    chooseEnabled:
      (await ui.get('puzzle-load-file').isVisible()) &&
      (await ui.get('puzzle-load-file').attribute('aria-disabled')) !== 'true',

    needsFile: await ui.get('puzzle-source-missing').isVisible(),
    saveOffered: await ui.get('puzzle-source-save').isVisible(),
    startOffered:
      saved &&
      (await ui.get('puzzle-load-start').attribute('disabled')) === null,
    offline: await ui.get('puzzle-load-offline').isVisible(),
    offlineMessage: (await ui.get('puzzle-load-offline').isVisible())
      ? await ui.get('puzzle-load-offline').text()
      : null,
  };
}

export async function reloadPuzzleSource(s: ProductHarness, actor = 'alice') {
  const person = s.actors.get(actor);
  if (!person) throw new Error('Actor missing');
  await person.openLink('/more');
  await person.openLink('/more/puzzles');
  await pollUntil(
    s,
    async () => {
      const source = await readPuzzleSource(s, actor);
      return source.saved || source.needsFile || source.offline ? true : null;
    },
    { maxMs: 15000, description: 'shared Lichess file availability' }
  );
}

export const saveLichessFile = scenarioAction({
  name: 'saveLichessFile',
  act: async (s, actor: string) => {
    const ui = await actorUi(s, actor);
    const view = await readPuzzleSource(s, actor);
    if (view.saved || view.offline || !view.saveOffered) return;
    await ui.get('puzzle-load-file').selectFile({
      name: 'lichess.csv',
      bytes: [...new TextEncoder().encode(importFixture(1))],
    });
    await ui.get('puzzle-source-save').tap();
    await pollUntil(
      s,
      async () => ((await readPuzzleSource(s, actor)).saved ? true : null),
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
