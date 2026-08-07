import {
  useHasAuthSession,
  useIsAnon,
} from '@libs/auth/client/use-current-user';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { MyUsername } from '@libs/profile/client/my-username';
import { useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  RegisterStatusBarItem,
  Text,
  useStatusBar,
} from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback } from 'react';

function UserPanel(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { close } = useStatusBar();
  const isAnon = useIsAnon();
  const signedIn = useHasAuthSession();
  const onAccount = useCallback(() => {
    close();
    router.push('/more/account');
  }, [close, router]);

  return (
    <Box sx={{ gap: 2 }}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <MyProfileAvatar size={36} />
        {signedIn && !isAnon ? (
          <MyUsername />
        ) : (
          <Text variant="body" label={t`Guest (anonymous)`} />
        )}
      </Box>
      <Button title={t`Open account`} variant="outline" onPress={onAccount} />
    </Box>
  );
}

/**
 * Registers the current user avatar into the global status bar.
 */
export function UserStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const isAnon = useIsAnon();
  const signedIn = useHasAuthSession();
  const caption = signedIn && !isAnon ? t`Signed in` : t`Guest`;

  return (
    <RegisterStatusBarItem
      id="current-user"
      order={30}
      title={t`Account`}
      caption={caption}
      accessibilityLabel={t`Current user`}
      indicator={<MyProfileAvatar size={14} />}
      leading={<MyProfileAvatar size={28} />}
      panel={<UserPanel />}
    />
  );
}
