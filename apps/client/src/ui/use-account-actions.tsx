import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useLogger } from '@gamezilla/lib/logger/react';
import { Box, StatusDot, Text, type ScreenBaseAction } from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useAsync } from '@gamezilla/lib/async/use-async';

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
      if (auth.mode === 'signed-in') {
        await auth.signOut();
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
  const latencyLabel =
    health.phase === 'loading'
      ? '…'
      : health.latencyMs !== null
        ? `${health.latencyMs} ms`
        : '—';
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

function buildConnectionAction(
  serverStatus: ServerStatus,
  onServerStatus: () => void
): ScreenBaseAction {
  return {
    type: 'default',
    label: 'Connection',
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
  auth: Auth,
  onAuth: () => Promise<void>
): ScreenBaseAction {
  return {
    type: 'default',
    label: auth.mode === 'signed-in' ? 'Sign out' : 'Sign in',
    icon:
      auth.mode === 'signed-in'
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
  auth: Auth;
  serverStatus: ServerStatus;
  onProfile: () => void;
  onSettings: () => void;
  onServerStatus: () => void;
  onAuth: () => Promise<void>;
}): ScreenBaseAction[] {
  const { auth, serverStatus, onProfile, onSettings, onServerStatus, onAuth } =
    args;
  return [
    {
      type: 'default',
      label: 'Profile',
      onPress: onProfile,
      icon: 'person.fill',
      overflow: 'always',
    },
    buildConnectionAction(serverStatus, onServerStatus),
    buildAuthAction(auth, onAuth),
    {
      type: 'default',
      label: 'Settings',
      onPress: onSettings,
      icon: 'gearshape.fill',
      overflow: 'always',
    },
  ];
}

/**
 * Header overflow actions for account / connection / settings.
 * Tab roots should pass these only on mobile (`useBreakpoint() === 'mobile'`).
 */
export function useAccountActions(): ScreenBaseAction[] {
  const auth = useAuth();
  const serverStatus = useServerStatus();
  const { onProfile, onSettings, onServerStatus } = useAccountNav();
  const onAuth = useAuthAction(auth);

  return useMemo(
    () =>
      buildActions({
        auth,
        serverStatus,
        onProfile,
        onSettings,
        onServerStatus,
        onAuth,
      }),
    [auth, serverStatus, onProfile, onSettings, onServerStatus, onAuth]
  );
}
