import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useSecureStorage } from '@gamezilla/client/runtime/runtime-hooks';
import {
  type AccountDevice,
  useAccountDevices,
} from '@gamezilla/client/auth/use-account-devices';
import {
  type AccountSessionAggregate,
  useSessionsForDevices,
} from '@gamezilla/client/auth/use-device-account-sessions';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
} from '@gamezilla/domain/auth';
import { Box, Button, Card, ScreenBase, Text } from '@gamezilla/lib/ui';
import { useQuery } from '@gamezilla/patch-db/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { type Href, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { AccountDevicesCard } from './account-devices-card';
import { formatTimestamp } from './account-format';
import { useAccountRemoveLocalData } from './use-account-remove-local-data';

type LinkedProvider = {
  entityId: string;
  provider: string;
  providerUserId: string;
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
} {
  const result = useQuery(
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
        const provider = asString(
          entity.attributes[AccountProviderAttr.provider]
        );
        const providerUserId = asString(
          entity.attributes[AccountProviderAttr.providerUserId]
        );
        if (provider === null || providerUserId === null) return null;
        return {
          entityId: entity.entityId,
          provider,
          providerUserId,
          email: asString(entity.attributes[AccountProviderAttr.email]),
          linkedAt: asString(entity.attributes[AccountProviderAttr.linkedAt]),
        };
      })
      .filter((p): p is LinkedProvider => p !== null);
  }, [accountId, result.entities]);

  return { providers };
}

function CaptionLine({ label }: { label: string }) {
  return (
    <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
  );
}

function LinkedProviderRow({ provider }: { provider: LinkedProvider }) {
  const { t } = useLingui();
  const connectedAt = formatTimestamp(provider.linkedAt);
  const providerUserId = provider.providerUserId;
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
        label={t`Provider user id: ${providerUserId}`}
      />
    </Box>
  );
}

function LinkedProvidersBody({
  accountId,
  providers,
}: {
  accountId: string | null;
  providers: LinkedProvider[];
}) {
  const { t } = useLingui();
  if (accountId === null) {
    return (
      <CaptionLine
        label={t`OAuth provider details are listed here once you are signed in.`}
      />
    );
  }
  if (providers.length === 0) {
    return (
      <CaptionLine
        label={t`No OAuth provider records on file for this user.`}
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
}: {
  accountId: string | null;
  providers: LinkedProvider[];
}) {
  const { t } = useLingui();
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label={<Trans>Sign-in providers</Trans>} />
      <CaptionLine
        label={t`Read-only: OAuth identities stored for your account.`}
      />
      <LinkedProvidersBody accountId={accountId} providers={providers} />
    </Card>
  );
}

function AccountActionsRow({
  auth,
  onRequestSignOut,
  onSignIn,
  onRemoveLocalData,
}: {
  auth: ReturnType<typeof useAuth>;
  onRequestSignOut: () => void;
  onSignIn: () => void;
  onRemoveLocalData: () => void;
}) {
  const { t } = useLingui();
  return (
    <Box sx={{ gap: 2 }}>
      {auth.isAuthenticated ? (
        <>
          {Platform.OS !== 'web' ? (
            <Button
              title={t`Remove local data for this account`}
              color="destructive"
              onPress={onRemoveLocalData}
            />
          ) : null}
          <Button
            title={t`Sign out`}
            color="destructive"
            onPress={onRequestSignOut}
          />
        </>
      ) : (
        <Button title={t`Sign in`} onPress={onSignIn} />
      )}
    </Box>
  );
}

function AccountScreenBody({
  auth,
  providers,
  devices,
  sessionsByDevice,
  onSignIn,
  onRequestSignOut,
  onRemoveLocalData,
  onOpenDevice,
  sx,
}: {
  auth: ReturnType<typeof useAuth>;
  providers: LinkedProvider[];
  devices: AccountDevice[];
  sessionsByDevice: Map<string, AccountSessionAggregate>;
  onSignIn: () => void;
  onRequestSignOut: () => void;
  onRemoveLocalData: () => void;
  onOpenDevice: (deviceId: string) => void;
  sx: object;
}) {
  return (
    <Box style={{ ...sx, gap: 12 }}>
      <AccountDevicesCard
        accountId={auth.accountId}
        devices={devices}
        sessionsByDevice={sessionsByDevice}
        onOpenDevice={onOpenDevice}
      />
      <LinkedProvidersCard accountId={auth.accountId} providers={providers} />
      <AccountActionsRow
        auth={auth}
        onRequestSignOut={onRequestSignOut}
        onSignIn={onSignIn}
        onRemoveLocalData={onRemoveLocalData}
      />
    </Box>
  );
}

export function AccountScreen() {
  const nav = useBreadcrumbNav();
  const router = useRouter();
  const auth = useAuth();
  const secureStorage = useSecureStorage();
  const { providers } = useLinkedProviders(auth.accountId);

  const currentDeviceId = auth.deviceId;
  const { devices } = useAccountDevices(auth.accountId, currentDeviceId);
  const deviceIds = useMemo(() => devices.map((p) => p.entityId), [devices]);
  const { sessionsByDevice } = useSessionsForDevices(deviceIds);

  const onOpenDevice = useCallback(
    (deviceId: string) => {
      router.push(`/more/account/device/${deviceId}` as Href);
    },
    [router]
  );

  const onSignIn = useCallback(() => {
    auth.openSignInModal();
  }, [auth]);

  const onRequestSignOut = useCallback(() => {
    auth.openSignOutConfirm();
  }, [auth]);

  const onRemoveLocalData = useAccountRemoveLocalData({
    accountId: auth.accountId,
    secureStorage,
    refreshSession: auth.refreshSession,
  });

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
          devices={devices}
          sessionsByDevice={sessionsByDevice}
          onSignIn={onSignIn}
          onRequestSignOut={onRequestSignOut}
          onRemoveLocalData={onRemoveLocalData}
          onOpenDevice={onOpenDevice}
          sx={sx}
        />
      )}
    />
  );
}
