import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import { useLingui } from '@lingui/react/macro';

import { resolveSpaceFallbackTitleParts } from '../shared/resolve-space-fallback-title-parts';
import { useSpaceHostMembershipDisplay } from './members/use-space-host-membership-display';
import { useSpaceColumn, SpaceField } from './use-space-column';

/** Live space title for cards, miniplayer, a11y, and command palette. */
export function useSpaceDisplayTitle(spaceId: string): string {
  const { t } = useLingui();
  const customTitle = useSpaceColumn(spaceId, SpaceField.title);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostUsername = useProfileColumn(
    host?.profileId ?? '',
    ProfileField.username
  );
  if (customTitle !== null && customTitle.length > 0) {
    return customTitle;
  }
  const parts = resolveSpaceFallbackTitleParts(hostUsername, spaceId);
  if (parts.kind === 'host') {
    return t`${parts.hostName}'s space`;
  }
  return t`Space ${parts.suffix}`;
}
