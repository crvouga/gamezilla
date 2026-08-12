import {
  useHasAuthSession,
  useIsAnon,
} from '@libs/auth/client/use-current-user';
import { Handles } from '@libs/dst-handles';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { useLingui } from '@lingui/react/macro';
import { RegisterStatusBarItem, useStatusBar } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback } from 'react';

/**
 * Registers the current user avatar into the global status bar.
 */
export function UserStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const { close } = useStatusBar();
  const isAnon = useIsAnon();
  const signedIn = useHasAuthSession();
  const caption = signedIn && !isAnon ? t`Signed in` : t`Guest`;
  const onPress = useCallback(() => {
    close();
    router.push('/more/account');
  }, [close, router]);

  return (
    <RegisterStatusBarItem
      id="current-user"
      order={30}
      contentKey={caption}
      title={t`Account`}
      caption={caption}
      accessibilityLabel={t`Current user`}
      testID={Handles.statusCurrentUser}
      active={signedIn && !isAnon}
      indicator={<MyProfileAvatar size={14} />}
      leading={<MyProfileAvatar size={28} />}
      onPress={onPress}
    />
  );
}
