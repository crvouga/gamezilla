import { Trans, useLingui } from '@lingui/react/macro';
import { Box, MenuList, MenuRow, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { type Href, useRouter } from 'expo-router';
import type { ReactNode } from 'react';

import { AccountActionsRow } from './account-actions-row';

export type AccountScreenProps = {
  /** Profile identity block (avatar + username + email). */
  readonly identity?: ReactNode;
};

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
        <Box sx={[sx, { gap: 3 }]}>
          {identity}
          <MenuList>
            <MenuRow
              title={t`Devices`}
              caption={t`Installs signed into this account`}
              onPress={() => {
                router.push('/more/account/devices' as Href);
              }}
            />
          </MenuList>
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
