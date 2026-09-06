import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  type Href,
  MenuRow,
  MenuSection,
  ScreenBase,
  SmartphoneIcon,
  useRouter,
  useTheme,
} from '@pkgs/ui-rn';
import { useBreadcrumbNav } from '@pkgs/ui-rn/components/use-breadcrumb-nav';
import type { ReactNode } from 'react';

import { AccountActionsRow } from './account-actions-row';

const ROW_ICON_SIZE = 20;

export type AccountScreenProps = {
  /** Profile identity block (avatar + username + email). */
  readonly identity?: ReactNode;
};

export function AccountScreen({ identity }: AccountScreenProps) {
  const { t } = useLingui();
  const theme = useTheme();
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
        <Box sx={[sx, { gap: 5 }]}>
          {identity}
          <MenuSection title={<Trans>Security</Trans>}>
            <MenuRow
              title={t`Devices`}
              caption={t`Installs signed into this account`}
              leading={
                <SmartphoneIcon
                  size={ROW_ICON_SIZE}
                  color={theme.colors.icon}
                />
              }
              onPress={() => {
                router.push('/more/account/devices' as Href);
              }}
            />
          </MenuSection>
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
