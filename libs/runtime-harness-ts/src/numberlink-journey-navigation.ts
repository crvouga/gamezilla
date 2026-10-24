import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';

export async function openNumberlinkLibrary(ui: Driver): Promise<void> {
  if (await ui.get('content-create-puzzle').isVisible()) return;
  if (!(await ui.get(Handles.gameChoice('puzzle-library')).isVisible()))
    await tap(ui, Handles.gameMenu('numberlink'));
  await tap(ui, Handles.gameChoice('puzzle-library'));
  await ui
    .get('content-create-puzzle')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/** Open saved work after the space's restored game choice has settled. */
export async function openNumberlinkSpace(
  host: Pick<JourneyHost, 'openLink' | 'act'>,
  link: string
): Promise<void> {
  await host.openLink(link);
  await host.act(
    'openNumberlinkLibraryAfterSpaceNavigation',
    openNumberlinkLibrary
  );
}
