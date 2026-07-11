import { useSpaceActions } from './space-actions';
import { useCurrentSpaceCount } from '../use-current-space-count';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { Button, useMutationButton } from '@pkgs/ui';
import { Sounds } from '@pkgs/sounds';
import { useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export type SpaceJoinButtonProps = {
  spaceId: string;
  joinable: boolean;
};

export function SpaceJoinButton({
  spaceId,
  joinable,
}: SpaceJoinButtonProps): ReactNode {
  const { t } = useLingui();
  const { joinSpace } = useSpaceActions();
  const role = useCurrentSpaceRole(spaceId);
  const { count: currentCount, isLoading: membershipLoading } =
    useCurrentSpaceCount();
  const inThisSpace = role !== null;
  const disabled =
    membershipLoading ||
    !joinable ||
    (!inThisSpace && currentCount > 0) ||
    spaceId.length === 0;

  const join = useMutationButton({
    operation: useCallback(() => joinSpace(spaceId), [joinSpace, spaceId]),
    labels: {
      idle: t`Join space`,
      loading: t`Joining…`,
      success: t`Joined`,
      error: t`Couldn't join`,
    },
    disabled,
    sounds: {
      success: Sounds.social.roomJoined,
      error: Sounds.feedback.error,
    },
  });

  return <Button {...join.buttonProps} />;
}
