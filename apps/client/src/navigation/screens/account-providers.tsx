import { Trans } from '@lingui/react/macro';
import {
  Box,
  EmptyState,
  KeyRoundIcon,
  ScreenBase,
  useBreadcrumbNav,
} from '@pkgs/ui';

/**
 * Stub — linked sign-in providers UI previously read synced `entity_store`
 * rows. That table is backend-only now; restore when auth rewires onto
 * `@pkgs/entity-store`.
 */
export default function AccountProvidersStubScreen() {
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      screenId="account-providers"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        { name: <Trans>Account</Trans>, onPress: nav('/more/account') },
        { name: <Trans>Sign-in providers</Trans> },
      ]}
      content={({ sx }) => (
        <Box sx={sx}>
          <EmptyState
            icon={KeyRoundIcon}
            title={<Trans>Sign-in providers unavailable</Trans>}
            body={
              <Trans>
                Linked provider details are temporarily unavailable. Check back
                soon.
              </Trans>
            }
          />
        </Box>
      )}
    />
  );
}
