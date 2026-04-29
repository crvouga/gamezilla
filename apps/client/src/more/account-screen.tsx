import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  type AccountPrincipal,
  useAccountPrincipals,
} from '@gamezilla/client/auth/use-account-principals';
import {
  type PrincipalSessionAggregate,
  useSessionsForPrincipals,
} from '@gamezilla/client/auth/use-principals-sessions';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
} from '@gamezilla/domain/auth';
import { Box, Button, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { Trans, useLingui } from '@gamezilla/lib/i18n';
import { useEntities } from '@gamezilla/patch-db/react';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { AccountDevicesCard } from './account-devices-card';
import { formatTimestamp } from './account-format';

type LinkedProvider = {
  entityId: string;
  provider: string;
  providerAccountId: string;
  email: string | null;
  linkedAt: string | null;
};

const PROVIDER_LABELS: Record<string, string> = {
  [GOOGLE_PROVIDER]: String('Google'),
};

function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function useLinkedProviders(accountId: string | null): {
  providers: LinkedProvider[];
  loading: boolean;
} {
  const result = useEntities(
    accountId === null
      ? { entityType: ACCOUNT_PROVIDER_ENTITY_TYPE, limit: 0 }
      : {
          entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
          where: {
            type: '=',
            attribute: AccountProviderAttr.accountId,
            value: accountId,
          },
        }
  );

  const providers = useMemo<LinkedProvider[]>(() => {
    if (accountId === null) return [];
    return result.entities
      .map((entity): LinkedProvider | null => {
        const provider = asString(entity.attributes[AccountProviderAttr.provider]);
        const providerAccountId = asString(
          entity.attributes[AccountProviderAttr.providerAccountId]
        );
        if (provider === null || providerAccountId === null) return null;
        return {
          entityId: entity.entityId,
          provider,
          providerAccountId,
          email: asString(entity.attributes[AccountProviderAttr.email]),
          linkedAt: asString(entity.attributes[AccountProviderAttr.linkedAt]),
        };
      })
      .filter((p): p is LinkedProvider => p !== null);
  }, [accountId, result.entities]);

  return { providers, loading: result.loading };
}

function CaptionLine({ label }: { label: string }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

function LinkedProviderRow({ provider }: { provider: LinkedProvider }) {
  const { t } = useLingui();
  const connectedAt = formatTimestamp(provider.linkedAt);
  const providerAccountId = provider.providerAccountId;
  return (
    <Box sx={{ gap: 1 }}>
      <Text variant="bodyBold" label={providerLabel(provider.provider)} />
      {provider.email !== null ? (
        <Text variant="caption" selectable label={provider.email} />
      ) : null}
      <CaptionLine label={t`Connected: ${connectedAt}`} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        selectable
        label={t`Provider account id: ${providerAccountId}`}
      />
    </Box>
  );
}

function LinkedProvidersBody({
  accountId,
  providers,
  loading,
}: {
  accountId: string | null;
  providers: LinkedProvider[];
  loading: boolean;
}) {
  const { t } = useLingui();
  if (accountId === null) {
    return (
      <CaptionLine
        label={t`OAuth provider details are listed here once you are signed in.`}
      />
    );
  }
  if (loading) {
    return <CaptionLine label={t`Loading provider records…`} />;
  }
  if (providers.length === 0) {
    return (
      <CaptionLine
        label={t`No OAuth provider records on file for this account.`}
      />
    );
  }
  return (
    <Box sx={{ gap: 3 }}>
      {providers.map((provider) => (
        <LinkedProviderRow key={provider.entityId} provider={provider} />
      ))}
    </Box>
  );
}

function LinkedProvidersCard({
  accountId,
  providers,
  loading,
}: {
  accountId: string | null;
  providers: LinkedProvider[];
  loading: boolean;
}) {
  const { t } = useLingui();
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Sign-in providers</Trans>} />
      <CaptionLine
        label={t`Read-only: OAuth identities stored for your account.`}
      />
      <LinkedProvidersBody
        accountId={accountId}
        providers={providers}
        loading={loading}
      />
    </Card>
  );
}

function AccountActionsRow({
  auth,
  onRequestSignOut,
  onSignIn,
}: {
  auth: ReturnType<typeof useAuth>;
  onRequestSignOut: () => void;
  onSignIn: () => void;
}) {
  const { t } = useLingui();
  return (
    <Box sx={{ gap: 2 }}>
      {auth.mode === 'signed-in' ? (
        <Button
          title={t`Sign out`}
          color="destructive"
          onPress={onRequestSignOut}
        />
      ) : (
        <Button title={t`Sign in`} onPress={onSignIn} />
      )}
    </Box>
  );
}

function AccountScreenBody({
  auth,
  providers,
  loading,
  principals,
  principalsLoading,
  sessionsByPrincipal,
  sessionsLoading,
  onSignIn,
  onRequestSignOut,
  onOpenDevice,
  sx,
}: {
  auth: ReturnType<typeof useAuth>;
  providers: LinkedProvider[];
  loading: boolean;
  principals: AccountPrincipal[];
  principalsLoading: boolean;
  sessionsByPrincipal: Map<string, PrincipalSessionAggregate>;
  sessionsLoading: boolean;
  onSignIn: () => void;
  onRequestSignOut: () => void;
  onOpenDevice: (principalId: string) => void;
  sx: object;
}) {
  return (
    <Box style={{ ...sx, gap: 12 }}>
      <AccountDevicesCard
        accountId={auth.accountId}
        principals={principals}
        principalsLoading={principalsLoading}
        sessionsByPrincipal={sessionsByPrincipal}
        sessionsLoading={sessionsLoading}
        onOpenDevice={onOpenDevice}
      />
      <LinkedProvidersCard
        accountId={auth.accountId}
        providers={providers}
        loading={loading}
      />
      <AccountActionsRow
        auth={auth}
        onRequestSignOut={onRequestSignOut}
        onSignIn={onSignIn}
      />
    </Box>
  );
}

export function AccountScreen() {
  const nav = useBreadcrumbNav();
  const router = useRouter();
  const auth = useAuth();
  const { providers, loading } = useLinkedProviders(auth.accountId);

  const currentPrincipalId = auth.principalId;
  const { principals, loading: principalsLoading } = useAccountPrincipals(
    auth.accountId,
    currentPrincipalId
  );
  const principalIds = useMemo(
    () => principals.map((p) => p.entityId),
    [principals]
  );
  const { sessionsByPrincipal, loading: sessionsLoading } =
    useSessionsForPrincipals(principalIds);

  const onOpenDevice = useCallback(
    (principalId: string) => {
      router.push(`/more/account/device/${principalId}` as Href);
    },
    [router]
  );

  const onSignIn = useCallback(() => {
    auth.openSignInModal();
  }, [auth]);

  const onRequestSignOut = useCallback(() => {
    auth.openSignOutConfirm();
  }, [auth]);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        { name: <Trans>Settings</Trans>, onPress: nav('/more') },
        {
          name: <Trans>Account</Trans>,
          subtitle: <Trans>Devices and sign-in provider records</Trans>,
        },
      ]}
      scroll
      content={({ sx }) => (
        <AccountScreenBody
          auth={auth}
          providers={providers}
          loading={loading}
          principals={principals}
          principalsLoading={principalsLoading}
          sessionsByPrincipal={sessionsByPrincipal}
          sessionsLoading={sessionsLoading}
          onSignIn={onSignIn}
          onRequestSignOut={onRequestSignOut}
          onOpenDevice={onOpenDevice}
          sx={sx}
        />
      )}
    />
  );
}
