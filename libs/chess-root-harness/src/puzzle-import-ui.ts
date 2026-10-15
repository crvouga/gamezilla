import { ingestChessPuzzleCsv } from '@libs/chess-puzzle-harness/chess-puzzle-data';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { importFixture } from './puzzle-import-fixtures';

const selections = new WeakMap<
  ProductHarness,
  { sequence: number; last: number; broken: boolean }
>();
function selection(s: ProductHarness) {
  let value = selections.get(s);
  if (!value) {
    value = { sequence: 0, last: 0, broken: false };
    selections.set(s, value);
  }
  return value;
}

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
  act: (s) => {
    selection(s).broken = true;
  },
});

export const startPuzzleLoading = scenarioAction({
  name: 'startPuzzleLoading',
  act: async (s, actor: string, refresh = false, refreshSource?: number) => {
    const ui = await actorUi(s, actor);
    const start = ui.get('puzzle-load-start');
    if (!(await start.isVisible())) return; // The policy's denial surface is the outcome.
    if (
      (await ui.get('puzzle-load-stop').isVisible()) ||
      (await ui.get('puzzle-load-offline').isVisible())
    )
      return;
    const chosen = selection(s);
    const sequence = refresh
      ? (refreshSource ?? chosen.last)
      : ++chosen.sequence;
    chosen.last = sequence;
    await ui.get('puzzle-load-file').selectFile({
      name: 'lichess.csv',
      bytes: [
        ...new TextEncoder().encode(importFixture(sequence, chosen.broken)),
      ],
    });
    await pollUntil(
      s,
      async () => ((await start.attribute('disabled')) === null ? true : null),
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

export async function readPuzzleImport(s: ProductHarness, actor = 'alice') {
  const ui = await actorUi(s, actor);
  const read = async (name: string) =>
    (await ui.get(name).isVisible()) ? await ui.get(name).text() : null;
  const text = (await read('puzzle-load-status')) ?? 'Ready';
  const number = async (name: string) =>
    Number(((await read(name)) ?? '0').match(/\d+/)?.[0] ?? 0);
  return {
    status:
      (
        {
          'Adding puzzles': 'adding',
          Finished: 'finished',
          Failed: 'failed',
          Stopped: 'stopped',
        } as Record<string, string>
      )[text.trim()] ?? 'ready',
    added: await number('puzzle-load-added'),
    updated: await number('puzzle-load-updated'),
    broken: await number('puzzle-load-broken'),
    poolSize: await number('puzzle-load-pool'),
    error: await read('puzzle-load-error'),
    stopOffered: await ui.get('puzzle-load-stop').isVisible(),
    stopDisabled:
      (await ui.get('puzzle-load-stop').isVisible()) &&
      (await ui.get('puzzle-load-stop').attribute('disabled')) !== null,
    offline: await ui.get('puzzle-load-offline').isVisible(),
    startDisabled:
      (await ui.get('puzzle-load-start').isVisible()) &&
      (await ui.get('puzzle-load-start').attribute('disabled')) !== null,
    denied: await ui.get('permission-denial').isVisible(),
    denialText: await read('permission-denial'),
  };
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
