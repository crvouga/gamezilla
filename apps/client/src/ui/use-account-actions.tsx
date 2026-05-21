import {
  useSignInModal,
  useSignOutModal,
} from '@gamezilla/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@gamezilla/auth/client/use-current-user';
import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useLogger } from '@gamezilla/logger/react';
import { useAsync } from '@gamezilla/async/use-async';
import { Box, StatusDot, Text, type ScreenBaseAction } from '@gamezilla/ui';
import { useLingui } from '@lingui/react/macro';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

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

function useAuthAction(
  isAuthenticated: boolean,
  openSignOutConfirm: () => void,
  openSignInModal: () => void
) {
  const log = useLogger('use-account-actions');
  const { run } = useAsync({
    operation: async () => {
      if (isAuthenticated) {
        openSignOutConfirm();
      } else {
        openSignInModal();
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
  isAuthenticated: boolean,
  onAuth: () => Promise<void>
): ScreenBaseAction {
  return {
    type: 'default',
    label: isAuthenticated ? labels.signOut : labels.signIn,
    icon: isAuthenticated ? 'arrow.right.from.bracket' : 'right.to.bracket',
    overflow: 'always',
    onPress: () => {
      void onAuth();
    },
    endsGroup: true,
  };
}

function buildActions(args: {
  labels: Labels;
  isAuthenticated: boolean;
  serverStatus: ServerStatus;
  onProfile: () => void;
  onSettings: () => void;
  onServerStatus: () => void;
  onAuth: () => Promise<void>;
}): ScreenBaseAction[] {
  const {
    labels,
    isAuthenticated,
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
    buildAuthAction(labels, isAuthenticated, onAuth),
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
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const serverStatus = useServerStatus();
  const { onProfile, onSettings, onServerStatus } = useAccountNav();
  const onAuth = useAuthAction(
    isAuthenticated,
    openSignOutConfirm,
    openSignInModal
  );

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
        isAuthenticated,
        serverStatus,
        onProfile,
        onSettings,
        onServerStatus,
        onAuth,
      }),
    [
      labels,
      isAuthenticated,
      serverStatus,
      onProfile,
      onSettings,
      onServerStatus,
      onAuth,
    ]
  );
}
