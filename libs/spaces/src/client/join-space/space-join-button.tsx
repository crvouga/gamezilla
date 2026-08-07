import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { useLingui } from '@lingui/react/macro';
import { Sounds } from '@pkgs/sounds';
import { Button, useMutationButton } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import { type ReactNode, useCallback } from 'react';
import { useJoinSpace } from './use-join-space';

export type SpaceJoinButtonProps = {
  spaceId: string;
  joinable: boolean;
  /** Stretch within a footer row (matches FormActionsFooter submit). */
  flex?: number;
};

export function SpaceJoinButton({
  spaceId,
  joinable,
  flex,
}: SpaceJoinButtonProps): ReactNode {
  const { t } = useLingui();
  const joinSpace = useJoinSpace();
  const signedIn = useIsSignedIn();
  const disabled = !signedIn || !joinable || spaceId.length === 0;

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

  return <Button {...join.buttonProps} {...optionalProps({ flex })} />;
}
