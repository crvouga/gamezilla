import { useMyDeviceId, useMyId } from '@libs/auth/client/use-current-user';
import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import { useLingui } from '@lingui/react/macro';

import { resolveSpaceFallbackTitleParts } from '../shared/resolve-space-fallback-title-parts';
import { resolveSpaceTitleUsername } from '../shared/resolve-space-title-username';
import { useSpaceHostMembershipDisplay } from './members/use-space-host-membership-display';
import { useSpaceColumn, SpaceField } from './use-space-column';

/** Live space title for cards, miniplayer, a11y, and command palette. */
export function useSpaceDisplayTitle(spaceId: string): string {
  const { t } = useLingui();
  const customTitle = useSpaceColumn(spaceId, SpaceField.title);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostProfileId = host?.profileId ?? '';
  const myId = useMyId();
  const myDeviceId = useMyDeviceId();
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const hostUsername = useProfileColumn(hostProfileId, ProfileField.username);
  const myUsername = useProfileColumn(
    myId.length > 0 ? myId : '',
    ProfileField.username
  );
  if (customTitle !== null && customTitle.length > 0) {
    return customTitle;
  }
  const parts = resolveSpaceFallbackTitleParts(
    resolveSpaceTitleUsername({
      hostUsername,
      myUsername,
      hostProfileId,
      myId,
      hostId,
      myDeviceId,
    })
  );
  if (parts.kind === 'host') {
    return t`${parts.hostName}'s space`;
  }
  return t`Space`;
}
