import { Handles } from '@libs/test-ids-shared-ts/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { JOURNEY_WAIT_MS, tap } from './journey-gestures';
import type { JourneyHost } from './journey-types';

export async function openNumberlinkLibrary(ui: Driver): Promise<void> {
  await tap(ui, Handles.gameMenu('numberlink'));
  await tap(ui, Handles.gameChoice('puzzle-library'));
  await ui
    .get('content-create-puzzle')
    .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/** Following a saved space link starts at its game menu. */
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
