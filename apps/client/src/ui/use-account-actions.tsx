import { useAuth } from '@gamezilla/auth/client/auth-context';
import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useLogger } from '@gamezilla/client/runtime/runtime-hooks';
import { useAsync } from '@gamezilla/lib/async/use-async';
import { Box, StatusDot, Text, type ScreenBaseAction } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

type Auth = ReturnType<typeof useAuth>;
type ServerStatus = ReturnType<typeof useServerStatus>;

function useAccountNav() {
  const router = useRouter();
  const onProfile = useCallback(() => {
    router.push('/profile');
  }, [router]);
  const onSettings = useCallback(() => {
    router.push('/more');
  }, [router]);
  const onServerStatus = useCallback(() => {
    router.push('/more/server-status');
  }, [router]);
  return { onProfile, onSettings, onServerStatus };
}

function useAuthAction(auth: Auth) {
  const log = useLogger('use-account-actions');
  const { run } = useAsync({
    operation: async () => {
      if (auth.isAuthenticated) {
        auth.openSignOutConfirm();
      } else {
        auth.openSignInModal();
      }
    },
    options: {
      onError: (err) => {
        log.error('auth action failed', { error: err.message });
      },
    },
  });
  return useCallback(async () => {
    try {
      await run();
    } catch {
      // onError already logged via hook.
    }
  }, [run]);
}

function ConnectionTrailing({
  aggregateStatus,
  health,
}: {
  aggregateStatus: ServerStatus['aggregateStatus'];
  health: ServerStatus['health'];
}) {
  const { t } = useLingui();
  const ms = health.latencyMs;
  const latencyLabel =
    health.phase === 'loading' ? '…' : ms !== null ? t`${ms} ms` : '—';
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        flexShrink: 0,
      }}
    >
      <StatusDot status={aggregateStatus} size={10} />
      <Text
        variant="caption"
        sx={{ color: 'textSecondary' }}
        label={latencyLabel}
      />
    </Box>
  );
}

type Labels = {
  profile: string;
  connection: string;
  settings: string;
  signIn: string;
  signOut: string;
};

function buildConnectionAction(
  labels: Labels,
  serverStatus: ServerStatus,
  onServerStatus: () => void
): ScreenBaseAction {
  return {
    type: 'default',
    label: labels.connection,
    icon: 'wifi',
    overflow: 'always',
    onPress: onServerStatus,
    trailing: (
      <ConnectionTrailing
        aggregateStatus={serverStatus.aggregateStatus}
        health={serverStatus.health}
      />
    ),
  };
}

function buildAuthAction(
  labels: Labels,
  auth: Auth,
  onAuth: () => Promise<void>
): ScreenBaseAction {
  return {
    type: 'default',
    label: auth.isAuthenticated ? labels.signOut : labels.signIn,
    icon: auth.isAuthenticated
      ? 'arrow.right.from.bracket'
      : 'right.to.bracket',
    overflow: 'always',
    onPress: () => {
      void onAuth();
    },
    endsGroup: true,
  };
}

function buildActions(args: {
  labels: Labels;
  auth: Auth;
  serverStatus: ServerStatus;
  onProfile: () => void;
  onSettings: () => void;
  onServerStatus: () => void;
  onAuth: () => Promise<void>;
}): ScreenBaseAction[] {
  const {
    labels,
    auth,
    serverStatus,
    onProfile,
    onSettings,
    onServerStatus,
    onAuth,
  } = args;
  return [
    {
      type: 'default',
      label: labels.profile,
      onPress: onProfile,
      icon: 'person.fill',
      overflow: 'always',
    },
    buildConnectionAction(labels, serverStatus, onServerStatus),
    buildAuthAction(labels, auth, onAuth),
    {
      type: 'default',
      label: labels.settings,
      onPress: onSettings,
      icon: 'gearshape.fill',
      overflow: 'always',
    },
  ];
}

/**
 * Header overflow actions for user / connection / settings.
 * Tab roots should pass these only on mobile (`useBreakpoint() === 'mobile'`).
 */
export function useAccountActions(): ScreenBaseAction[] {
  const { t } = useLingui();
  const auth = useAuth();
  const serverStatus = useServerStatus();
  const { onProfile, onSettings, onServerStatus } = useAccountNav();
  const onAuth = useAuthAction(auth);

  const labels = useMemo<Labels>(
    () => ({
      profile: t`Profile`,
      connection: t`Connection`,
      settings: t`Settings`,
      signIn: t`Sign in`,
      signOut: t`Sign out`,
    }),
    [t]
  );

  return useMemo(
    () =>
      buildActions({
        labels,
        auth,
        serverStatus,
        onProfile,
        onSettings,
        onServerStatus,
        onAuth,
      }),
    [labels, auth, serverStatus, onProfile, onSettings, onServerStatus, onAuth]
  );
}
