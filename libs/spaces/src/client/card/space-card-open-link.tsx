import { Pressable, type PressableProps } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { openSpaceDetail } from '../space-routes';
import { useSpaceDisplayTitle } from '../use-space-display-title';

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
  const resolvedTitle = useSpaceDisplayTitle(spaceId);
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
