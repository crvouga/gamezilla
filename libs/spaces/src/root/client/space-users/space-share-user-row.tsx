import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import { UserUsername } from '@libs/profile/public/user-username';
import { Box } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export function SpaceShareUserRow(props: {
  readonly userId: string;
  readonly trailing: JSX.Element | null;
}): JSX.Element {
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        py: 2,
      }}
    >
      <UserProfileAvatar profileId={props.userId} size={44} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <UserUsername
          profileId={props.userId}
          variant="bodyBold"
          numberOfLines={1}
        />
      </Box>
      {props.trailing}
    </Box>
  );
}
