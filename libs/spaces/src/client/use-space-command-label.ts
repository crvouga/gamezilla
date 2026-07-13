import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import { useLingui } from '@lingui/react/macro';

import { useSpaceColumn, SpaceField } from './use-space-column';

const ID_SUFFIX_LENGTH = 8;

/** Plain-string label for a space (command palette titles). */
export function useSpaceCommandLabel(spaceId: string): string {
  const { t } = useLingui();
  const customTitle = useSpaceColumn(spaceId, SpaceField.title);
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  const hostUsername = useProfileColumn(
    hostId ?? '',
    ProfileField.username
  );
  if (customTitle !== null && customTitle.length > 0) return customTitle;
  if ((hostUsername ?? '').length > 0) {
    return t`${hostUsername}'s space`;
  }
  const suffix = spaceId.slice(-ID_SUFFIX_LENGTH);
  return t`Space ${suffix}`;
}
