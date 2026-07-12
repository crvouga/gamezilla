/**
 * Compact account menu trigger for tab-root headers. Standard user-menu items
 * (Account / Settings / Sign in or out) anchored on the profile avatar.
 */

import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import {
  Box,
  FloatingMenu,
  IconButton,
  iconButtonAvatarContentSize,
  useAnchoredMenu,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useAccountMenuContent,
  useAccountMenuTriggerLabel,
} from '../use-account-menu';

const TRIGGER_SIZE = 36;

export function AppAccountMenu(): ReactNode {
  const { t } = useLingui();
  const insets = useSafeAreaInsets();
  const menu = useAnchoredMenu();
  const menuContent = useAccountMenuContent(menu.close);
  const triggerLabel = useAccountMenuTriggerLabel();

  const accessibilityLabel = useMemo(
    () => triggerLabel || t`User menu`,
    [triggerLabel, t]
  );

  return (
    <>
      <Box ref={menu.triggerRef} collapsable={false}>
        <IconButton
          variant="avatar"
          size={TRIGGER_SIZE}
          onPress={menu.openMenu}
          label={accessibilityLabel}
          accessibilityLabel={accessibilityLabel}
          testID="account-menu-trigger"
        >
          <MyProfileAvatar size={iconButtonAvatarContentSize(TRIGGER_SIZE)} />
        </IconButton>
      </Box>
      <FloatingMenu
        open={menu.open}
        onClose={menu.close}
        anchor={menu.anchor}
        insets={insets}
        content={menuContent}
      />
    </>
  );
}
