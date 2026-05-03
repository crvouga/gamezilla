import { PrincipalAvatar } from '@gamezilla/client/profile/principal-avatar';
import { useProfile } from '@gamezilla/client/profile/use-profile';
import { useAccountActions } from '@gamezilla/client/ui/use-account-actions';
import {
  Box,
  Button,
  ScreenBase,
  Text,
  useBreakpoint,
} from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';

export function ProfileScreen() {
  const { t } = useLingui();
  const router = useRouter();
  const profile = useProfile();
  const accountActions = useAccountActions();
  const isMobile = useBreakpoint() === 'mobile';

  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Profile</Trans> }]}
      actions={isMobile ? accountActions : []}
      content={({ sx }) => (
        <Box style={sx}>
          <Box sx={{ alignItems: 'center', gap: 2 }}>
            <PrincipalAvatar
              avatarConfig={profile.avatarConfig}
              principalId={profile.principalId}
              size={80}
            />
            <Text variant="title" label={profile.displayLabel} />
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
