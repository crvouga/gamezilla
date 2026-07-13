import { useJoinSpace } from './use-join-space';
import { useCurrentSpaceCount } from '../use-current-space-count';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { Button, useMutationButton } from '@pkgs/ui';
import { Sounds } from '@pkgs/sounds';
import { useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export type SpaceJoinButtonProps = {
  spaceId: string;
  joinable: boolean;
  inviteToken?: string | null;
};

export function SpaceJoinButton({
  spaceId,
  joinable,
  inviteToken,
}: SpaceJoinButtonProps): ReactNode {
  const { t } = useLingui();
  const joinSpace = useJoinSpace();
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
    operation: useCallback(
      () =>
        joinSpace(spaceId, {
          inviteToken: inviteToken ?? null,
        }),
      [joinSpace, spaceId, inviteToken]
    ),
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
