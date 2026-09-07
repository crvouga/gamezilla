import { Handles } from '@libs/test-ids';
import { Plural } from '@lingui/solid/macro';
import { Box, ChevronRightIcon, Clickable, Text, useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { useFriends } from '../../use-cases/list-friends/client/use-friends';
import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';

const CHEVRON_SIZE = 18;

export function ProfileFriendsStats(): JSX.Element {
  const navigate = useFriendsProfileNavigation();
  const theme = useTheme();
  const { friends } = useFriends();
  const count = friends.length;

  return (
    <Clickable
      onClick={() => navigate(FriendsProfileRoute.Friends)}
      sx={{
        alignSelf: 'stretch',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 3,
        py: 1,
        borderRadius: 'md',
      }}
      dataSet={{ testid: Handles.profileFriendsStats }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text variant="heading" label={String(count)} />
        <Text
          variant="body"
          sx={{ color: 'textSecondary' }}
          label={<Plural value={count} one="friend" other="friends" />}
        />
      </Box>
      <ChevronRightIcon size={CHEVRON_SIZE} color={theme.colors.icon} />
    </Clickable>
  );
}
