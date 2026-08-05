/**
 * Dedicated account switcher: list local accounts, add another, switch with
 * loading chrome owned by AccountSwitchProvider.
 */

import { useAccountSwitch } from '../account-switch/account-switch-context';
import { useSwitchAccountCompleteNav } from '../account-switch/use-switch-account-complete-nav';
import { useSignInModal } from '../auth-modals-provider';
import {
  localAccountAccessibilityLabel,
  localAccountSubtitle,
} from '../local-account-helpers';
import {
  accountDisplayTitle,
  useLocalAccounts,
  type LocalAccount,
} from '../use-local-accounts';
import {
  Box,
  CircleCheckIcon,
  MenuList,
  MenuRow,
  PlusIcon,
  ScreenBase,
  releaseWebFocus,
} from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

const ROW_AVATAR_SIZE = 40;

export type AccountSwitcherScreenProps = {
  /** Avatar for each account row (lives in apps/client to avoid auth↔profile cycle). */
  readonly renderAvatar: (account: LocalAccount, size: number) => ReactNode;
};

function AccountSwitcherRow({
  account,
  disabled,
  onPress,
  leading,
}: {
  account: LocalAccount;
  disabled: boolean;
  onPress: () => void;
  leading: ReactNode;
}): ReactNode {
  const title = accountDisplayTitle(account);
  const subtitle = localAccountSubtitle(account);
  return (
    <MenuRow
      title={title}
      {...(subtitle !== undefined ? { caption: subtitle } : {})}
      leading={leading}
      trailing={account.isActive ? <CircleCheckIcon size={20} /> : undefined}
      hideChevron
      selected={account.isActive}
      disabled={disabled || account.isActive}
      onPress={onPress}
      accessibilityLabel={localAccountAccessibilityLabel(title, subtitle)}
      testID={`account-switcher-row-${account.sessionId}`}
    />
  );
}

export function AccountSwitcherScreen({
  renderAvatar,
}: AccountSwitcherScreenProps): ReactNode {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const accounts = useLocalAccounts();
  const { switchToAccount, isPending } = useAccountSwitch();
  const { open: openSignInModal } = useSignInModal();
  const onSwitchComplete = useSwitchAccountCompleteNav();
  const activeAccountId =
    accounts.find((account) => account.isActive)?.accountId ?? null;

  const onSwitch = useCallback(
    (account: LocalAccount) => {
      if (account.isActive || isPending) return;
      if (account.accountId !== null && account.accountId === activeAccountId) {
        return;
      }
      releaseWebFocus();
      void switchToAccount({
        sessionId: account.sessionId,
        accountId: account.accountId,
        displayTitle: accountDisplayTitle(account),
        onComplete: onSwitchComplete,
      }).catch(() => undefined);
    },
    [switchToAccount, isPending, activeAccountId, onSwitchComplete]
  );

  const onAddAccount = useCallback(() => {
    releaseWebFocus();
    openSignInModal();
  }, [openSignInModal]);

  return (
    <ScreenBase
      screenId="account-switcher"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          onPress: nav('/more/account'),
        },
        { name: <Trans>Switch account</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          <MenuList>
            {accounts.map((account) => (
              <AccountSwitcherRow
                key={account.sessionId}
                account={account}
                disabled={isPending}
                onPress={() => onSwitch(account)}
                leading={renderAvatar(account, ROW_AVATAR_SIZE)}
              />
            ))}
            <MenuRow
              title={t`Add account`}
              leading={<PlusIcon size={22} />}
              hideChevron
              disabled={isPending}
              onPress={onAddAccount}
              testID="account-switcher-add"
            />
          </MenuList>
        </Box>
      )}
    />
  );
}
