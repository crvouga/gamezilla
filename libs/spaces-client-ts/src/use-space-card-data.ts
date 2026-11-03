import { type Accessor, createMemo } from 'solid-js';
import { useSpacePresence } from './public-use-space-presence';
import type { SpaceCardData } from './space-card-view';
import { useIsSpaceOpenLocally } from './use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';
import { useSpaceDisplayTitle } from './use-space-display-title';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';
import { useSpaceHostUsername } from './use-space-host-username';
import { useSpacePeople, useSpacePerson } from './use-space-people';

/** Everything a space card shows about `spaceId`, plus whether it ended. */
export type SpaceCardRead = SpaceCardData & { readonly ended: boolean };

/** Reads one space for {@link SpaceCardView} and the join prompt's summary. */
export function useSpaceCardData(
  spaceId: Accessor<string>
): Accessor<SpaceCardRead> {
  const endedAt = useSpaceColumn(spaceId, SpaceField.endedAt);
  const title = useSpaceDisplayTitle(spaceId);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostPerson = useSpacePerson(() => host()?.profileId ?? null);
  const hostUsername = useSpaceHostUsername(spaceId);
  const isOpen = useIsSpaceOpenLocally(spaceId);
  const presence = useSpacePresence(spaceId);
  const guests = useSpacePeople(useSpaceGuestMembershipIds(spaceId()));
  return createMemo((): SpaceCardRead => {
    const ended = endedAt() !== null;
    return {
      spaceId: spaceId(),
      title: title(),
      host: hostPerson(),
      hostUsername: hostUsername(),
      badge: ended ? 'none' : isOpen() ? 'current' : 'live',
      active: presence().status === 'active',
      guests: guests(),
      ended,
    };
  });
}
