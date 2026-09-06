import { Trans, useLingui } from '@lingui/solid/macro';
import {
  Box,
  MenuRow,
  MenuSection,
  ScreenBase,
  SmartphoneIcon,
  useRouter,
} from '@pkgs/ui';
import type { JSX } from 'solid-js';

import { AccountActionsRow } from './account-actions-row';

const ROW_ICON_SIZE = 20;

export type AccountScreenProps = {
  /** Profile identity block (avatar + username + email). */
  readonly identity?: JSX.Element | undefined;
};

export function AccountScreen(props: AccountScreenProps): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();

  return (
    <ScreenBase
      screenId="account"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Account</Trans> },
      ]}
      scroll
      content={({ sx }) => (
        <Box sx={[sx, { gap: 5 }]}>
          {props.identity}
          <MenuSection title={<Trans>Security</Trans>}>
            <MenuRow
              title={t`Devices`}
              caption={t`Installs signed into this account`}
              leading={<SmartphoneIcon size={ROW_ICON_SIZE} color="icon" />}
              onClick={() => {
                router.push('/more/account/devices');
              }}
            />
          </MenuSection>
          <AccountActionsRow />
        </Box>
      )}
    />
  );
}
