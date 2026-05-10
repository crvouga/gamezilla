import { MyDisplayName } from './my-display-name';
import { MyProfileAvatar } from './my-profile-avatar';
import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import { Box, Button, ScreenBase, useBreakpoint } from '@gamezilla/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

export function ProfileScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const accountActions = useAccountActions();
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      actions={isMobile ? accountActions : []}
      content={({ sx }) => (
        <Box style={sx}>
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <MyProfileAvatar size={80} />
            <MyDisplayName variant="title" />
          </Box>
          <Box sx={{ mt: 2, alignSelf: 'stretch' }}>
            <Button
              title={t`Edit profile`}
              onPress={() => router.push('/profile/edit')}
            />
          </Box>
        </Box>
      )}
    />
  );
}
