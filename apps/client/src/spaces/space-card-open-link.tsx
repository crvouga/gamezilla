import { parseDisplayName } from '@gamezilla/client/profile/profile-parsers';
import { parseStringAttr } from '@gamezilla/client/spaces/space-parsers';
import { NO_ENTITY_PLACEHOLDER } from '@gamezilla/client/spaces/spaces-internal-ids';
import {
  PROFILE_ENTITY_TYPE,
  ProfileAttr,
} from '@gamezilla/domain/profile/profile-entities';
import {
  SPACE_ENTITY_TYPE,
  SpaceAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { Pressable, type PressableProps } from '@gamezilla/lib/ui';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
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
    attributeKey: SpaceAttr.title,
    attributeValue: parseStringAttr,
  });
  const hostId = useQueryAttribute({
    entityType: SPACE_ENTITY_TYPE,
    entityId: spaceId,
    attributeKey: SpaceAttr.hostId,
    attributeValue: parseStringAttr,
  });
  const hostDisplayName = useQueryAttribute({
    entityType: PROFILE_ENTITY_TYPE,
    entityId: hostId ?? NO_ENTITY_PLACEHOLDER,
    attributeKey: ProfileAttr.displayName,
    attributeValue: parseDisplayName,
  });
  const resolvedTitle = customTitle ?? t`${hostDisplayName}'s space`;
  const accessibilityLabel =
    accessibilityLabelOverride ?? t`Open space ${resolvedTitle}`;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/space/[id]', params: { id: spaceId } })}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {children}
    </Pressable>
  );
}
