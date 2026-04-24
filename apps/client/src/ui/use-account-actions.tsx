import { useAuth } from '@gamezilla/client/auth/auth-context';
import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useLogger } from '@gamezilla/lib/logger/react';
import { Box, StatusDot, Text, type ScreenBaseAction } from '@gamezilla/lib/ui';
import { useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';

/**
 * Header overflow actions for account / connection / settings.
 * Tab roots should pass these only on mobile (`useBreakpoint() === 'mobile'`).
 */
export function useAccountActions(): ScreenBaseAction[] {
  const log = useLogger('use-account-actions');
  const router = useRouter();
  const auth = useAuth();
  const { aggregateStatus, health } = useServerStatus();

  const onProfile = useCallback(() => {
    router.push('/profile');
  }, [router]);

  const onSettings = useCallback(() => {
    router.push('/more');
  }, [router]);

  const onServerStatus = useCallback(() => {
    router.push('/more/server-status');
  }, [router]);

  const onAuth = useCallback(async () => {
    try {
      if (auth.mode === 'signed-in') {
        await auth.signOut();
      } else {
        await auth.signInWithGoogle();
      }
    } catch (err: unknown) {
      log.error('auth action failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }, [auth, log]);

  return useMemo((): ScreenBaseAction[] => {
    const latencyLabel =
      health.phase === 'loading'
        ? '…'
        : health.latencyMs !== null
          ? `${health.latencyMs} ms`
          : '—';

    return [
      {
        type: 'default',
        label: 'Profile',
        onPress: onProfile,
        icon: 'person.fill',
        overflow: 'always',
      },
      {
        type: 'default',
        label: 'Connection',
        icon: 'wifi',
        overflow: 'always',
        onPress: onServerStatus,
        trailing: (
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
        ),
      },
      {
        type: 'default',
        label: auth.mode === 'signed-in' ? 'Sign out' : 'Sign in with Google',
        icon:
          auth.mode === 'signed-in'
            ? 'arrow.right.from.bracket'
            : 'right.to.bracket',
        overflow: 'always',
        onPress: () => {
          void onAuth();
        },
        endsGroup: true,
      },
      {
        type: 'default',
        label: 'Settings',
        onPress: onSettings,
        icon: 'gearshape.fill',
        overflow: 'always',
      },
    ];
  }, [
    aggregateStatus,
    auth.mode,
    health.latencyMs,
    health.phase,
    onAuth,
    onProfile,
    onServerStatus,
    onSettings,
  ]);
}
