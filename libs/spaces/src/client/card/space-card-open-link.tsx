import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@libs/profile/shared/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@libs/spaces/shared/space-entities';
import { Pressable, type PressableProps } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

export type SpaceCardOpenLinkProps = {
  spaceId: string;
  children: ReactNode;
  /** Optional override; default is `Open space ${title}`. */
  accessibilityLabelOverride?: string;
  style?: PressableProps['style'];
};

/**
 * Pressable that navigates to the space detail screen, owning both the
 * id-to-route mapping and the resolved accessibility label.
 *
 * The title used in the accessibility label is resolved inline (custom title
 * with `${hostName}'s space` fallback) so callers don't have to thread it.
 */
export function SpaceCardOpenLink({
  spaceId,
  children,
  accessibilityLabelOverride,
  style,
}: SpaceCardOpenLinkProps): ReactNode {
  const router = useRouter();
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
  const resolvedTitle = customTitle ?? t`${hostDisplayName}'s space`;
  const accessibilityLabel =
    accessibilityLabelOverride ?? t`Open space ${resolvedTitle}`;
  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/space/[id]', params: { id: spaceId } })
      }
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {children}
    </Pressable>
  );
}
