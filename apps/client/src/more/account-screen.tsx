import { useAuth } from '@gamezilla/client/auth/auth-context';
import {
  useAccountPrincipals,
  type AccountPrincipal,
} from '@gamezilla/client/auth/use-account-principals';
import {
  useProfilesForPrincipals,
  type PrincipalProfileSummary,
} from '@gamezilla/client/auth/use-principals-profiles';
import {
  useSessionsForPrincipals,
  type PrincipalSessionAggregate,
} from '@gamezilla/client/auth/use-principals-sessions';
import { ProfileDiceBearAvatar } from '@gamezilla/client/profile/profile-dicebear-avatar';
import { useProfile } from '@gamezilla/client/profile/use-profile';
import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  AccountProviderAttr,
  GOOGLE_PROVIDER,
} from '@gamezilla/domain/auth';
import {
  Badge,
  Box,
  Button,
  Card,
  ScreenBase,
  Text,
} from '@gamezilla/lib/ui';
import { useEntities } from '@gamezilla/patch-db/react';
import { useRouter } from 'expo-router';
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
  [GOOGLE_PROVIDER]: 'Google',
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

function IdentityCard({
  profile,
  auth,
}: {
  profile: ReturnType<typeof useProfile>;
  auth: ReturnType<typeof useAuth>;
}) {
  const statusLabel = auth.mode === 'signed-in' ? 'Signed in' : 'Guest';
  const statusColor = auth.mode === 'signed-in' ? 'success' : 'warning';
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
        <ProfileDiceBearAvatar
          config={profile.avatarConfig}
          fallbackSeed={profile.principalId}
          size={56}
          loading={profile.loading}
        />
        <Box sx={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text
            variant="bodyBold"
            numberOfLines={1}
            label={profile.loading ? '\u00A0' : profile.displayLabel}
          />
          <Box sx={{ flexDirection: 'row' }}>
            <Badge label={statusLabel} color={statusColor} size="sm" />
          </Box>
        </Box>
      </Box>
    </Card>
  );
}

function LinkedProviderRow({ provider }: { provider: LinkedProvider }) {
  return (
    <Box sx={{ gap: 1 }}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        <Text variant="bodyBold" label={providerLabel(provider.provider)} />
        <Badge label="Linked" color="success" size="sm" />
      </Box>
      {provider.email !== null ? (
        <Text variant="caption" selectable label={provider.email} />
      ) : null}
      <CaptionLine label={`Linked: ${formatTimestamp(provider.linkedAt)}`} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        selectable
        label={`Provider account: ${provider.providerAccountId}`}
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
  if (accountId === null) {
    return <CaptionLine label="Sign in with a provider to link an account." />;
  }
  if (loading) {
    return <CaptionLine label="Loading linked accounts…" />;
  }
  if (providers.length === 0) {
    return <CaptionLine label="No providers linked." />;
  }
  return (
    <Box sx={{ gap: 3 }}>
      {providers.map((provider) => (
        <LinkedProviderRow key={provider.entityId} provider={provider} />
      ))}
    </Box>
  );
}

function LinkedAccountsActions({
  auth,
  hasGoogleLinked,
  onSignIn,
}: {
  auth: ReturnType<typeof useAuth>;
  hasGoogleLinked: boolean;
  onSignIn: () => void;
}) {
  const googleAvailable = auth.providers.google.available;
  if (!googleAvailable) {
    return auth.providers.google.unavailableReason !== null ? (
      <CaptionLine label={auth.providers.google.unavailableReason} />
    ) : null;
  }
  if (auth.mode !== 'signed-in') {
    return (
      <Button
        title="Sign in with Google"
        variant="outlined"
        onPress={onSignIn}
      />
    );
  }
  if (!hasGoogleLinked) {
    return <Button title="Link Google" variant="outlined" onPress={onSignIn} />;
  }
  return null;
}

function LinkedAccountsCard({
  accountId,
  providers,
  loading,
  auth,
  onSignIn,
}: {
  accountId: string | null;
  providers: LinkedProvider[];
  loading: boolean;
  auth: ReturnType<typeof useAuth>;
  onSignIn: () => void;
}) {
  const hasGoogleLinked = providers.some((p) => p.provider === GOOGLE_PROVIDER);
  return (
    <Card elevation={1} sx={{ p: 4, gap: 3 }}>
      <Text variant="bodyBold" label="Linked accounts" />
      <LinkedProvidersBody
        accountId={accountId}
        providers={providers}
        loading={loading}
      />
      <LinkedAccountsActions
        auth={auth}
        hasGoogleLinked={hasGoogleLinked}
        onSignIn={onSignIn}
      />
    </Card>
  );
}

function AccountActionsRow({
  auth,
  onEditProfile,
  onRequestSignOut,
  onSignIn,
}: {
  auth: ReturnType<typeof useAuth>;
  onEditProfile: () => void;
  onRequestSignOut: () => void;
  onSignIn: () => void;
}) {
  return (
    <Box sx={{ gap: 2 }}>
      <Button
        title="Edit profile"
        variant="outlined"
        onPress={onEditProfile}
      />
      {auth.mode === 'signed-in' ? (
        <Button
          title="Sign out"
          color="destructive"
          onPress={onRequestSignOut}
        />
      ) : (
        <Button title="Sign in" onPress={onSignIn} />
      )}
    </Box>
  );
}

function AccountScreenBody({
  auth,
  profile,
  providers,
  loading,
  principals,
  principalsLoading,
  profilesByPrincipal,
  profilesLoading,
  sessionsByPrincipal,
  sessionsLoading,
  onSignIn,
  onEditProfile,
  onRequestSignOut,
  sx,
}: {
  auth: ReturnType<typeof useAuth>;
  profile: ReturnType<typeof useProfile>;
  providers: LinkedProvider[];
  loading: boolean;
  principals: AccountPrincipal[];
  principalsLoading: boolean;
  profilesByPrincipal: Map<string, PrincipalProfileSummary>;
  profilesLoading: boolean;
  sessionsByPrincipal: Map<string, PrincipalSessionAggregate>;
  sessionsLoading: boolean;
  onSignIn: () => void;
  onEditProfile: () => void;
  onRequestSignOut: () => void;
  sx: object;
}) {
  return (
    <Box style={{ ...sx, gap: 12 }}>
      <IdentityCard profile={profile} auth={auth} />
      <AccountDevicesCard
        accountId={auth.accountId}
        principals={principals}
        principalsLoading={principalsLoading}
        profilesByPrincipal={profilesByPrincipal}
        profilesLoading={profilesLoading}
        sessionsByPrincipal={sessionsByPrincipal}
        sessionsLoading={sessionsLoading}
      />
      <LinkedAccountsCard
        accountId={auth.accountId}
        providers={providers}
        loading={loading}
        auth={auth}
        onSignIn={onSignIn}
      />
      <AccountActionsRow
        auth={auth}
        onEditProfile={onEditProfile}
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
  const profile = useProfile();
  const { providers, loading } = useLinkedProviders(auth.accountId);

  const currentPrincipalId = auth.principalId || profile.principalId;
  const { principals, loading: principalsLoading } = useAccountPrincipals(
    auth.accountId,
    currentPrincipalId
  );
  const principalIds = useMemo(
    () => principals.map((p) => p.entityId),
    [principals]
  );
  const { profilesByPrincipal, loading: profilesLoading } =
    useProfilesForPrincipals(principalIds);
  const { sessionsByPrincipal, loading: sessionsLoading } =
    useSessionsForPrincipals(principalIds);

  const onEditProfile = useCallback(() => {
    router.push('/profile/edit');
  }, [router]);

  const onSignIn = useCallback(() => {
    auth.openSignInModal();
  }, [auth]);

  const onRequestSignOut = useCallback(() => {
    auth.openSignOutConfirm();
  }, [auth]);

  return (
    <ScreenBase
      breadcrumbs={[
        { name: 'Spaces', onPress: nav('/') },
        { name: 'Settings', onPress: nav('/more') },
        {
          name: 'Account',
          subtitle: 'Identifiers, linked accounts, and session',
        },
      ]}
      scroll
      content={({ sx }) => (
        <AccountScreenBody
          auth={auth}
          profile={profile}
          providers={providers}
          loading={loading}
          principals={principals}
          principalsLoading={principalsLoading}
          profilesByPrincipal={profilesByPrincipal}
          profilesLoading={profilesLoading}
          sessionsByPrincipal={sessionsByPrincipal}
          sessionsLoading={sessionsLoading}
          onSignIn={onSignIn}
          onEditProfile={onEditProfile}
          onRequestSignOut={onRequestSignOut}
          sx={sx}
        />
      )}
    />
  );
}
