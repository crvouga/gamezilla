import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import {
  openContentLibrary,
  openContentSpace,
} from './content-library-navigation';
import type { JourneyHost } from './journey-types';

export function openNumberlinkLibrary(ui: Driver): Promise<void> {
  return openContentLibrary(ui, 'numberlink');
}

/** Open saved work after the space's restored game choice has settled. */
export function openNumberlinkSpace(
  host: Pick<JourneyHost, 'openLink' | 'act'>,
  link: string
): Promise<void> {
  return openContentSpace(host, link, 'numberlink');
}
