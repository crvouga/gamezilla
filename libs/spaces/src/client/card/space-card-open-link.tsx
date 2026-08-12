import { useLingui } from '@lingui/react/macro';
import { Pressable } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { useIsSpaceOpenLocally } from '../open-space/use-open-space-session-ids';
import { openSpaceDetail } from '../space-routes';
import { useSpaceDisplayTitle } from '../use-space-display-title';

export type SpaceCardOpenLinkProps = {
  spaceId: string;
  children: ReactNode;
  accessibilityLabelOverride?: string;
};

export function SpaceCardOpenLink({
  spaceId,
  children,
  accessibilityLabelOverride,
}: SpaceCardOpenLinkProps): ReactNode {
  const router = useRouter();
  const { t } = useLingui();
  const isOpen = useIsSpaceOpenLocally(spaceId);
  const resolvedTitle = useSpaceDisplayTitle(spaceId);
  const accessibilityLabel =
    accessibilityLabelOverride ??
    (isOpen
      ? t`Open current space ${resolvedTitle}`
      : t`Open space ${resolvedTitle}`);
  return (
    <Pressable
      onPress={() => openSpaceDetail(router, spaceId)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </Pressable>
  );
}
