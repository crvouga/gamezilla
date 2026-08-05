/**
 * Compact account menu trigger for tab-root headers. Menu items only (current
 * user → Account screen, Settings, Sign in/out) anchored on the profile avatar.
 */

import { ActionBar } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, type ReactNode } from 'react';

import {
  ACCOUNT_MENU_TRIGGER_SIZE,
  AccountMenuTriggerAvatar,
  useAccountMenuItems,
  useAccountMenuTriggerLabel,
  useAccountMenuTriggerSize,
} from '../use-account-menu';

export function AppAccountMenu(): ReactNode {
  const { t } = useLingui();
  const items = useAccountMenuItems();
  const triggerLabel = useAccountMenuTriggerLabel();
  const avatarSize = useAccountMenuTriggerSize();

  const accessibilityLabel = useMemo(
    () => triggerLabel || t`User menu`,
    [triggerLabel, t]
  );

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
      buttonSize={ACCOUNT_MENU_TRIGGER_SIZE}
    />
  );
}
