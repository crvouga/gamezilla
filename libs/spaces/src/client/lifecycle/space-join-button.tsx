import { useSpaceActions } from './space-actions';
import { useCurrentSpaceCount } from '../use-current-space-count';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { Button } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceJoinButtonProps = {
  spaceId: string;
};

/** Owns the `joinSpace` dispatch + the disabled rule. */
export function SpaceJoinButton({ spaceId }: SpaceJoinButtonProps): ReactNode {
  const { t } = useLingui();
  const { joinSpace } = useSpaceActions();
  const role = useCurrentSpaceRole(spaceId);
  const currentCount = useCurrentSpaceCount();
  const inThisSpace = role !== null;
  const disabled = !inThisSpace && currentCount > 0;

  return (
    <Button
      title={t`Join space`}
      disabled={disabled}
      onPress={() => {
        if (spaceId.length === 0) return;
        void joinSpace(spaceId);
      }}
    />
  );
}
