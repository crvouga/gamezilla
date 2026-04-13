import { Avatar, Box, Text } from '@gamezilla/shared/ui';

import { useAuth } from '@/features/auth/auth-context';
import { ConstrainedContent } from '@/ui/constrained-content';
import { ScreenHeader } from '@/ui/screen-header';

export default function ProfileScreen() {
  const auth = useAuth();

  return (
    <Box sx={{ flex: 1 }}>
      <ScreenHeader title="Profile" showAccountMenu />
      <ConstrainedContent>
        <Box sx={{ flex: 1, px: 4, pt: 4, gap: 4 }}>
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <Avatar initials={auth.displayName.slice(0, 2)} size={80} />
            <Text variant="title" label={auth.displayName} />
          </Box>
        </Box>
      </ConstrainedContent>
    </Box>
  );
}
