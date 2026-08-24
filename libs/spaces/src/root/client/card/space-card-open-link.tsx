import { Handles } from '@libs/dst-handles';
import { useLingui } from '@lingui/react/macro';
import { Pressable, useRouter } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';
import { openSpaceDetail } from '../../../public/space-routes';
import { useIsSpaceOpenLocally } from '../../../use-cases/list-open-sessions/client/use-open-space-session-ids';
import { useSpaceDisplayTitle } from '../use-space-display-title';
import { useSpaceHostUsername } from '../use-space-host-username';

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
  const hostUsername = useSpaceHostUsername(spaceId);
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
      {...optionalProps({
        testID:
          hostUsername !== null ? Handles.spaceCard(hostUsername) : undefined,
      })}
    >
      {children}
    </Pressable>
  );
}
