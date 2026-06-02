import { useSpaceActions } from './space-actions';
import { useCurrentSpaceCount } from '../use-current-space-count';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { Button, useMutationButton } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export type SpaceJoinButtonProps = {
  spaceId: string;
};

/** Owns the `joinSpace` dispatch + the disabled rule, with inline feedback. */
export function SpaceJoinButton({ spaceId }: SpaceJoinButtonProps): ReactNode {
  const { t } = useLingui();
  const { joinSpace } = useSpaceActions();
  const role = useCurrentSpaceRole(spaceId);
  const currentCount = useCurrentSpaceCount();
  const inThisSpace = role !== null;
  const disabled = (!inThisSpace && currentCount > 0) || spaceId.length === 0;

  const join = useMutationButton({
    operation: useCallback(() => joinSpace(spaceId), [joinSpace, spaceId]),
    labels: {
      idle: t`Join space`,
      loading: t`Joining…`,
      success: t`Joined`,
      error: t`Couldn't join`,
    },
    disabled,
  });

  return <Button {...join.buttonProps} />;
}
