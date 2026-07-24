/**
 * Compact account menu trigger for tab-root headers. Standard user-menu items
 * (Account / Settings / Sign in when signed out) anchored on the profile avatar.
 */

import { DeviceAvatar } from '@libs/profile/client/device-avatar';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import { ActionBar, iconButtonAvatarContentSize } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

import {
  ACCOUNT_MENU_TRIGGER_SIZE,
  useAccountMenuHeader,
  useAccountMenuItems,
  useAccountMenuTriggerLabel,
  useActiveLocalAccount,
} from '../use-account-menu';

function AccountMenuTriggerAvatar({ size }: { size: number }): ReactNode {
  const active = useActiveLocalAccount();
  if (active === undefined) {
    return (
      <DeviceAvatar avatarConfig={null} seedFallback="signed-out" size={size} />
    );
  }
  return <MyProfileAvatar size={size} />;
}

export function AppAccountMenu(): ReactNode {
  const { t } = useLingui();
  const items = useAccountMenuItems();
  const menuHeader = useAccountMenuHeader();
  const triggerLabel = useAccountMenuTriggerLabel();

  const accessibilityLabel = useMemo(
    () => triggerLabel || t`User menu`,
    [triggerLabel, t]
  );

  const avatarSize = iconButtonAvatarContentSize(ACCOUNT_MENU_TRIGGER_SIZE);

  return (
    <ActionBar
      items={items}
      overflow="auto"
      overflowTrigger={{
        variant: 'avatar',
        children: <AccountMenuTriggerAvatar size={avatarSize} />,
        label: accessibilityLabel,
        testID: 'account-menu-trigger',
      }}
      overflowMenuHeader={menuHeader}
      buttonSize={ACCOUNT_MENU_TRIGGER_SIZE}
    />
  );
}
