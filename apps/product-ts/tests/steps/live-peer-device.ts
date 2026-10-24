import { openIsolatedDevice } from '@apps/product-ts/isolated-browser';
import {
  type Device,
  emulateOffline,
  type LiveTarget,
  readLocation,
} from '@apps/product-ts/live-browser';
import {
  actOnLiveDevice,
  type LiveDevices,
  requireDevice,
} from '@apps/product-ts/live-journey-devices';
import { prepareCriticalJourneyAccess } from '@apps/product-ts/prepare-critical-journey-access';
import {
  atTabShell,
  confirmSignedIn,
} from '@libs/runtime-harness-ts/journey-gestures';
import type { JourneyPeerDevice } from '@libs/runtime-harness-ts/journey-types';
import { spaceLinkFromLocation } from '@libs/runtime-harness-ts/journey-types';

export function liveJourneyPeerDevice(
  target: LiveTarget,
  devices: LiveDevices,
  signIn: (device: Device) => Promise<void>
): JourneyPeerDevice {
  const current = () => requireDevice(devices.guest, 'peer');
  return {
    spaceLink: async () =>
      spaceLinkFromLocation(await readLocation(current().view)),
    reopen: () => current().driver.launch(),
    offline: () => emulateOffline(current().view),
    online: async () => {
      await current().view.cdp('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    },
    anotherSignedInDevice: async () => {
      const previous = current();
      await actOnLiveDevice(devices, previous, confirmSignedIn);
      const next = await openIsolatedDevice(target);
      devices.previousPeers.push(previous);
      devices.guest = next;
      devices.shown = next;
      await prepareCriticalJourneyAccess({
        access: 'signed-in',
        launch: () => next.driver.launch(),
        waitForTabShell: () => atTabShell(next.driver),
        signIn: () => signIn(next),
      });
    },
  };
}
