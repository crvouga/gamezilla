import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import { Handles } from '@libs/test-ids-shared-ts/handles';

/**
 * The puzzle loader is a hub and a place behind it: `load` holds the pool,
 * the Lichess file's row, starting or stopping and the latest result;
 * `source` holds everything about the Lichess file. A driver reaches a
 * control as a person does: the hub's row opens `source`, Back returns.
 */
export type LoaderPlace = 'load' | 'source';

/** A harness's actions and reads, as a step or a model binding holds them. */
export type LoaderRunner = Pick<OpenHarness, 'apply' | 'read'>;

/** The stage the loader stands in and the place shown; `null` away from it. */
export async function readLoaderPosition(
  s: ProductHarness,
  actor: string
): Promise<{ stage: string; place: string } | null> {
  const ui = await actorUi(s, actor);
  const content = ui.get('puzzle-load-content');
  if (!(await content.isVisible())) return null;
  return {
    stage: (await content.attribute('data-stage')) ?? '',
    place: (await content.attribute('data-place')) ?? '',
  };
}

/** A dialog over the loader: nothing under it can be pressed until it closes. */
async function loaderDialogOpen(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return (
    (await ui.get('puzzle-load-stop-modal').isVisible()) ||
    (await ui.get('pending-navigation-warning').isVisible())
  );
}

/**
 * Show `wanted` as a person would, and say whether it is shown. It is not
 * when the loader is closed, when the stage does not show that place (a
 * person outside the team sees only the denial; while the Lichess file is
 * being saved only `source` shows, and Back would leave the loader), or
 * when a dialog still asking or working covers the loader. A dialog that
 * only reports a finished stop is put away first.
 */
export async function showLoaderPlace(
  s: ProductHarness,
  actor: string,
  wanted: LoaderPlace
): Promise<boolean> {
  const at = await readLoaderPosition(s, actor);
  if (at === null) return false;
  if (at.place === wanted) return true;
  const ui = await actorUi(s, actor);
  if (await loaderDialogOpen(s, actor)) {
    // A finished stop only waits to be put away, as a person does before
    // moving on; a question still open is not this driver's to answer.
    if (!(await ui.get('puzzle-load-stop-success').isVisible())) return false;
    await ui.key('escape');
    if (await loaderDialogOpen(s, actor)) return false;
  }
  if (wanted === 'source') {
    const row = ui.get('puzzle-load-source');
    if (!(await row.isVisible())) return false;
    await row.tap();
  } else {
    // Back steps to the hub only from a place behind it.
    if (at.place !== 'source' || at.stage === 'saving') return false;
    await ui.get(Handles.navBack).tap();
  }
  return (await readLoaderPosition(s, actor))?.place === wanted;
}

/** Open a place of the loader, as a person would. */
export const openLoaderPlace = scenarioAction({
  name: 'openLoaderPlace',
  act: async (s, actor: string, place: LoaderPlace) => {
    await showLoaderPlace(s, actor, place);
  },
});
