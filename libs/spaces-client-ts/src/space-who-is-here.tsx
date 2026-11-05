/**
 * {@link SpaceWhoIsHereView} for the space this device is in: the same
 * connected faces as the members button, the host from the space row, and
 * Invite friends opening the space's Share sheet.
 */

import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';
import { useSpacePresenceFaces } from './space-presence-strip';
import { useSpaceShareDialog } from './space-share-dialog-context';
import { SpaceWhoIsHereView } from './space-who-is-here-view';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { useSpacePeople } from './use-space-people';

export function SpaceWhoIsHere(props: {
  readonly spaceId: string;
}): JSX.Element {
  const faces = useSpacePresenceFaces(() => props.spaceId);
  const host = useSpaceHostMembershipDisplay(() => props.spaceId);
  const myId = useMyId();
  const hostIds = createMemo((): readonly string[] => {
    const id = host()?.profileId;
    return id === undefined ? [] : [id];
  });
  const hostPeople = useSpacePeople(hostIds);
  const share = useSpaceShareDialog();
  return (
    <SpaceWhoIsHereView
      faces={faces()}
      host={hostPeople()[0] ?? null}
      hostIsYou={host() !== null && host()?.profileId === myId()}
      onInvite={share === undefined ? undefined : () => share.setOpen(true)}
    />
  );
}
