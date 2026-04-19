import { useServerStatus } from '@/features/connection/use-server-status';
import { useLogger } from '@gamezilla/shared/logger/react';
import {
  Box,
  FloatingMenu,
  Pressable,
  StatusDot,
  Text,
  type FloatingMenuContent,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';
import { ProfileDiceBearAvatar } from '@/features/profile/profile-dicebear-avatar';
import { useProfile } from '@/features/profile/use-profile';

/** Matches `measureInWindow` layout. */
type AnchorRect = { x: number; y: number; width: number; height: number };

export type AccountMenuVariant = 'header' | 'sidebar';

export type AccountMenuProps = {
  variant: AccountMenuVariant;
};

/**
 * App shell: avatar opens a {@link FloatingMenu} with profile and settings routes.
 */
export function AccountMenu({ variant }: AccountMenuProps) {
  const log = useLogger('account-menu');
  const router = useRouter();
  const auth = useAuth();
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const triggerRef = useRef<ElementRef<typeof Box>>(null);
  const { aggregateStatus, health, refresh } = useServerStatus();

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (open) {
      refresh();
    }
  }, [open, refresh]);

  const close = useCallback(() => {
    setOpen(false);
    setAnchor(null);
  }, []);

  const openMenu = useCallback(() => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setOpen(true);
    });
  }, []);

  const onProfile = useCallback(() => {
    close();
    router.push('/profile');
  }, [close, router]);

  const onSettings = useCallback(() => {
    close();
    router.push('/more');
  }, [close, router]);

  const onServerStatus = useCallback(() => {
    close();
    router.push('/more/server-status');
  }, [close, router]);

  const onAuth = useCallback(async () => {
    close();
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
  }, [auth, close, log]);

  const menuContent = useMemo((): FloatingMenuContent => {
    const statusWord =
      aggregateStatus === 'online'
        ? 'Online'
        : aggregateStatus === 'offline'
          ? 'Offline'
          : 'Limited or checking';
    const latencyPhrase =
      health.phase === 'loading'
        ? 'latency checking'
        : health.latencyMs !== null
          ? `latency ${health.latencyMs} ms`
          : 'latency unavailable';

    return {
      header: {
        title: profile.displayLabel,
        ...(profile.hasCustomDisplayName
          ? {
              subtitle:
                auth.mode === 'guest' ? 'Guest' : 'Signed in',
            }
          : {}),
      },
      rows: [
        {
          type: 'item',
          id: 'profile',
          label: 'Profile',
          icon: 'person.fill',
          onPress: onProfile,
          accessibilityLabel: 'View profile',
        },
        {
          type: 'item',
          id: 'server-status',
          label: 'Connection',
          icon: 'wifi',
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
                label={
                  health.phase === 'loading'
                    ? '…'
                    : health.latencyMs !== null
                      ? `${health.latencyMs} ms`
                      : '—'
                }
              />
            </Box>
          ),
          onPress: onServerStatus,
          accessibilityLabel: `Connection and server status. ${statusWord}. ${latencyPhrase}.`,
        },
        {
          type: 'item',
          id: 'sign-in',
          label:
            auth.mode === 'signed-in' ? 'Sign out' : 'Sign in with Google',
          icon:
            auth.mode === 'signed-in'
              ? 'arrow.right.from.bracket'
              : 'right.to.bracket',
          onPress: onAuth,
          accessibilityLabel:
            auth.mode === 'signed-in' ? 'Sign out' : 'Sign in with Google',
        },
        { type: 'divider', id: 'after-auth' },
        {
          type: 'item',
          id: 'settings',
          label: 'Settings',
          icon: 'gearshape.fill',
          onPress: onSettings,
          accessibilityLabel: 'Settings',
        },
      ],
    };
  }, [
    aggregateStatus,
    auth.mode,
    health.latencyMs,
    health.phase,
    onAuth,
    onProfile,
    onServerStatus,
    onSettings,
    profile.displayLabel,
    profile.hasCustomDisplayName,
  ]);

  return (
    <>
      <Box ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel="Account menu"
          accessibilityState={{ expanded: open }}
          hitSlop={6}
          sx={{
            borderRadius: 999,
            p: variant === 'sidebar' ? 1 : 0,
          }}
        >
          <ProfileDiceBearAvatar
            seed={profile.avatarSeed}
            size={variant === 'sidebar' ? 40 : 36}
          />
        </Pressable>
      </Box>

      <FloatingMenu
        open={open}
        onClose={close}
        anchor={anchor}
        insets={insets}
        content={menuContent}
      />
    </>
  );
}
