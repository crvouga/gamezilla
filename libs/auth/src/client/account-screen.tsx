import { Box, MenuList, MenuRow, ScreenBase, releaseWebFocus } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { AccountActionsRow } from './account-actions-row';
import { useLocalAccounts } from './use-local-accounts';

export type AccountScreenProps = {
  /** Profile identity block (avatar + username + email). */
  readonly identity?: ReactNode;
};

function SwitchAccountRow(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const accounts = useLocalAccounts();
  const count = accounts.length;
  const caption =
    count === 0
      ? undefined
      : count === 1
        ? t`1 account on this device`
        : t`${count} accounts on this device`;

  return (
    <MenuList>
      <MenuRow
        title={t`Switch account`}
        {...(caption !== undefined ? { caption } : {})}
        onPress={() => {
          releaseWebFocus();
          router.push('/more/account/switch' as Href);
        }}
        testID="account-switch-row"
      />
    </MenuList>
  );
}

export function AccountScreen({ identity }: AccountScreenProps) {
  const { t } = useLingui();
  const nav = useBreadcrumbNav();
  const router = useRouter();

  return (
    <ScreenBase
      screenId="account"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Account</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box style={sx} sx={{ gap: 3 }}>
          {identity}
          <SwitchAccountRow />
          <MenuList>
            <MenuRow
              title={t`Devices`}
              caption={t`Installs signed into this account`}
              onPress={() => {
                releaseWebFocus();
                router.push('/more/account/devices' as Href);
              }}
            />
            <MenuRow
              title={t`Sign-in providers`}
              caption={t`How you sign in`}
              onPress={() => {
                releaseWebFocus();
                router.push('/more/account/providers' as Href);
              }}
            />
          </MenuList>
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
