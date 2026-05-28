import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@libs/profile/shared/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { useLingui } from '@lingui/react/macro';

const ID_SUFFIX_LENGTH = 8;

/**
 * Plain-string label for a space, suitable for command-palette titles.
 *
 * Resolves the custom title with the localized `${hostName}'s space`
 * fallback, mirroring {@link SpaceTitleText}. Falls back to a short id
 * suffix while the host row hasn't synced yet so two unresolved entries
 * stay distinguishable in the palette.
 */
export function useSpaceCommandLabel(spaceId: string): string {
  const { t } = useLingui();
  const customTitle = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.title,
  });
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attribute: SpaceAttr.hostId,
  });
  const hostDisplayName = useQueryAttribute({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: hostId ?? [],
    attribute: ProfileAttr.displayName,
  });
  if (customTitle !== null) return customTitle;
  if (hostDisplayName.length > 0) {
    return t`${hostDisplayName}'s space`;
  }
  const suffix = spaceId.slice(-ID_SUFFIX_LENGTH);
  return t`Space ${suffix}`;
}
