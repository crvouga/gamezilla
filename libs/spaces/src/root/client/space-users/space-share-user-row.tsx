import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Box } from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

export function SpaceShareUserRow({
  userId,
  trailing,
}: {
  readonly userId: string;
  readonly trailing: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
      }}
    >
      <UserProfileAvatar profileId={userId} size={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <UserUsername profileId={userId} variant="bodyBold" numberOfLines={1} />
      </Box>
      {trailing}
    </Box>
  );
}
