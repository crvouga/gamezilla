import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';

/** A puzzle game's shared library, from wherever space navigation left the app. */
export async function openContentLibrary(
  ui: Driver,
  gameId: string
): Promise<void> {
  await ui.get('content-create-puzzle').wait('visible', {
    timeoutMs: JOURNEY_WAIT_MS,
    description: `${gameId} library or game choice after space navigation`,
    visibleOr: [Handles.gameMenu(gameId), Handles.gameChoice('puzzle-library')],
  });
  if (await ui.get('content-create-puzzle').isVisible()) return;
  if (!(await ui.get(Handles.gameChoice('puzzle-library')).isVisible()))
    await tap(ui, Handles.gameMenu(gameId));
  await tap(ui, Handles.gameChoice('puzzle-library'));
  await ui
    .get('content-create-puzzle')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/** Open saved work after the space's restored game choice has settled. */
export async function openContentSpace(
  host: Pick<JourneyHost, 'openLink' | 'act'>,
  link: string,
  gameId: string
): Promise<void> {
  await host.openLink(link);
  await host.act(`open-${gameId}-library-after-space-navigation`, (ui) =>
    openContentLibrary(ui, gameId)
  );
}
