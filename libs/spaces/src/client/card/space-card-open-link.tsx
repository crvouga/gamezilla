import { Pressable, type PressableProps } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { useOpenSpaceIds } from '../open-space/use-open-space-ids';
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
  const { isOpen } = useOpenSpaceIds();
  const resolvedTitle = useSpaceDisplayTitle(spaceId);
  const accessibilityLabel =
    accessibilityLabelOverride ??
    (isOpen(spaceId)
      ? t`Open current space ${resolvedTitle}`
      : t`Open space ${resolvedTitle}`);
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
