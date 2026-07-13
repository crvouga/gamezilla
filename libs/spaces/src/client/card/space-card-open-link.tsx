import {
  useProfileColumn,
  ProfileField,
} from '@libs/profile/client/use-profile-column';
import { Pressable, type PressableProps } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { useSpaceHostMembershipDisplay } from '../members/use-space-host-membership-display';
import { openSpaceDetail } from '../space-routes';
import { useSpaceColumn, SpaceField } from '../use-space-column';

export type SpaceCardOpenLinkProps = {
  spaceId: string;
  children: ReactNode;
  accessibilityLabelOverride?: string;
  style?: PressableProps['style'];
};

export function SpaceCardOpenLink({
  spaceId,
  children,
  accessibilityLabelOverride,
  style,
}: SpaceCardOpenLinkProps): ReactNode {
  const router = useRouter();
  const { t } = useLingui();
  const customTitle = useSpaceColumn(spaceId, SpaceField.title);
  const host = useSpaceHostMembershipDisplay(spaceId);
  const hostUsername = useProfileColumn(
    host?.profileId ?? '',
    ProfileField.username
  );
  const hostName = hostUsername ?? '';
  const resolvedTitle =
    customTitle !== null && customTitle.length > 0
      ? customTitle
      : t`${hostName}'s space`;
  const accessibilityLabel =
    accessibilityLabelOverride ?? t`Open space ${resolvedTitle}`;
  return (
    <Pressable
      onPress={() => openSpaceDetail(router, spaceId)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={style}
    >
      {children}
    </Pressable>
  );
}
