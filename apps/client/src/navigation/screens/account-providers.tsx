import { Trans, useLingui } from '@lingui/react/macro';
import { Box, ScreenBase, Text, useBreadcrumbNav } from '@pkgs/ui';

/**
 * Stub — linked sign-in providers UI previously read synced `entity_store`
 * rows. That table is backend-only now; restore when auth rewires onto
 * `@pkgs/entity-store`.
 */
export default function AccountProvidersStubScreen() {
  const { t } = useLingui();
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
        <Box sx={[sx, { gap: 2, p: 3 }]}>
          <Text
            label={t`Sign-in provider details are temporarily unavailable.`}
          />
        </Box>
      )}
    />
  );
}
