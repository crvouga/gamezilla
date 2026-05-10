import { useCurrentSpaceCount } from './use-current-space-count';
import { useCurrentSpaceRole } from './use-current-space-role';
import { Text } from '@gamezilla/lib/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceJoinBlockedNoteProps = {
  spaceId: string;
};

/** "You're already in a space" hint, gated on whether join is blocked. */
export function SpaceJoinBlockedNote({
  spaceId,
}: SpaceJoinBlockedNoteProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const currentCount = useCurrentSpaceCount();
  const inThisSpace = role !== null;
  if (inThisSpace) return null;
  if (currentCount === 0) return null;
  return (
    <Text
      variant="body"
      sx={{ color: 'textSecondary' }}
      label={<Trans>You’re already in a space</Trans>}
    />
  );
}
