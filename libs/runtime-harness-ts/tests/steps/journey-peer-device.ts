import { restartApp } from '@libs/harness-ts/actions';
import { signInWithGoogleAsAccount } from '@libs/harness-ts/auth-actions';
import { accountIdOf } from '@libs/harness-ts/identity';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { setWorkOfflineFromCurrentPlace } from '@libs/runtime-harness-ts/app-settings';
import { confirmSignedIn } from '@libs/runtime-harness-ts/journey-gestures';
import type {
  JourneyHost,
  JourneyPeerDevice,
} from '@libs/runtime-harness-ts/journey-types';
import { spaceLinkFromLocation } from '@libs/runtime-harness-ts/journey-types';

export function harnessJourneyPeerDevice(
  w: Pick<HarnessWorld, 's'>,
  peer: {
    current: () => string;
    select: (id: string) => void;
    account: string;
    act: JourneyHost['actAsGuest'];
  }
): JourneyPeerDevice {
  let deviceNumber = 1;
  return {
    spaceLink: () =>
      w.s.read(async (s) => {
        const actor = s.actors.get(peer.current());
        if (actor === undefined)
          throw new Error('The second person has not opened the app');
        return spaceLinkFromLocation(await actor.currentPath());
      }),
    reopen: () => w.s.apply(restartApp, peer.current()),
    offline: async () => {
      await w.s.apply(setWorkOfflineFromCurrentPlace, peer.current(), true);
      await w.s.advanceTime(1000);
    },
    online: () =>
      w.s.apply(setWorkOfflineFromCurrentPlace, peer.current(), false),
    anotherSignedInDevice: async () => {
      if ((await w.s.read(accountIdOf, peer.account)) === null)
        throw new Error(
          'The second person must sign in before opening another device'
        );
      const id = `${peer.account}-device-${++deviceNumber}`;
      await w.s.apply(signInWithGoogleAsAccount, id, peer.account);
      peer.select(id);
      await peer.act('confirmSameAccountOnAnotherDevice', confirmSignedIn);
    },
  };
}
