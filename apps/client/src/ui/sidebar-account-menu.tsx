/**
 * Wide-layout sidebar account row + {@link FloatingMenu} (same entries as header overflow).
 */

import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { asLocalized } from '@gamezilla/lib/i18n';
import { useLogger } from '@gamezilla/lib/logger/react';
import {
  Box,
  FloatingMenu,
  IconSymbol,
  Pressable,
  StatusDot,
  Text,
  useTheme,
  type FloatingMenuContent,
} from '@gamezilla/lib/ui';
import { t } from '@lingui/core/macro';
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

import { useAuth } from '@gamezilla/client/auth/auth-context';
import { PrincipalAvatar } from '@gamezilla/client/profile/principal-avatar';
import { useProfile } from '@gamezilla/client/profile/use-profile';
import { useAsync } from '@gamezilla/lib/async/use-async';

type AnchorRect = { x: number; y: number; width: number; height: number };

type Auth = ReturnType<typeof useAuth>;
type Profile = ReturnType<typeof useProfile>;
type ServerStatus = ReturnType<typeof useServerStatus>;

function useAccountMenuActions(args: {
  auth: Auth;
  close: () => void;
}) {
  const { auth, close } = args;
  const router = useRouter();
  const log = useLogger('sidebar-account-menu');

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

  const { run: runAuth } = useAsync({
    operation: async () => {
      if (auth.mode === 'signed-in') {
        auth.openSignOutConfirm();
      } else {
        auth.openSignInModal();
      }
    },
    options: {
      onError: (err) => {
        log.error('auth action failed', { error: err.message });
      },
    }
  });

  const onAuth = useCallback(async () => {
    close();
    try {
      await runAuth();
    } catch {
      // onError already logged via hook.
    }
  }, [close, runAuth]);

  return { onProfile, onSettings, onServerStatus, onAuth };
}

function ConnectionTrailing({
  aggregateStatus,
  health,
}: {
  aggregateStatus: ServerStatus['aggregateStatus'];
  health: ServerStatus['health'];
}) {
  const label =
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
        label={label}
      />
    </Box>
  );
}

function aggregateStatusWord(s: ServerStatus['aggregateStatus']): string {
  if (s === 'online') return 'Online';
  if (s === 'offline') return 'Offline';
  return 'Limited or checking';
}

function latencyPhrase(health: ServerStatus['health']): string {
  if (health.phase === 'loading') return 'latency checking';
  if (health.latencyMs !== null) return `latency ${health.latencyMs} ms`;
  return 'latency unavailable';
}

type MenuRow = FloatingMenuContent['rows'][number];

function buildHeader(profile: Profile): FloatingMenuContent['header'] {
  return {
    title: asLocalized(profile.displayLabel),
  };
}

function buildConnectionRow(args: {
  serverStatus: ServerStatus;
  onServerStatus: () => void;
}): MenuRow {
  const { serverStatus, onServerStatus } = args;
  const { aggregateStatus, health } = serverStatus;
  const accLabel = t`Connection and server status. ${aggregateStatusWord(aggregateStatus)}. ${latencyPhrase(health)}.`;
  return {
    type: 'item',
    id: 'server-status',
    label: t`Connection`,
    icon: 'wifi',
    trailing: (
      <ConnectionTrailing aggregateStatus={aggregateStatus} health={health} />
    ),
    onPress: onServerStatus,
    accessibilityLabel: accLabel,
  };
}

function buildAuthRow(auth: Auth, onAuth: () => void): MenuRow {
  const label = auth.mode === 'signed-in' ? t`Sign out` : t`Sign in`;
  return {
    type: 'item',
    id: 'sign-in',
    label,
    icon:
      auth.mode === 'signed-in'
        ? 'arrow.right.from.bracket'
        : 'right.to.bracket',
    onPress: onAuth,
    accessibilityLabel: label,
  };
}

function buildMenuContent(args: {
  profile: Profile;
  auth: Auth;
  serverStatus: ServerStatus;
  onProfile: () => void;
  onServerStatus: () => void;
  onAuth: () => void;
  onSettings: () => void;
}): FloatingMenuContent {
  const { profile, auth, serverStatus, onProfile, onServerStatus, onAuth, onSettings } = args;
  return {
    header: buildHeader(profile),
    rows: [
      {
        type: 'item',
        id: 'profile',
        label: t`Profile`,
        icon: 'person.fill',
        onPress: onProfile,
        accessibilityLabel: t`View profile`,
      },
      buildConnectionRow({ serverStatus, onServerStatus }),
      buildAuthRow(auth, onAuth),
      { type: 'divider', id: 'after-auth' },
      {
        type: 'item',
        id: 'settings',
        label: t`Settings`,
        icon: 'gearshape.fill',
        onPress: onSettings,
        accessibilityLabel: t`Settings`,
      },
    ],
  };
}

function AccountTrigger({
  triggerRef,
  open,
  openMenu,
  profile,
}: {
  triggerRef: React.RefObject<ElementRef<typeof Box> | null>;
  open: boolean;
  openMenu: () => void;
  profile: Profile;
}) {
  const theme = useTheme();
  return (
    <Box ref={triggerRef} collapsable={false} sx={{ alignSelf: 'stretch' }}>
      <Pressable
        onPress={openMenu}
        accessibilityRole="button"
        accessibilityLabel="Account menu"
        accessibilityState={{ expanded: open }}
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 3,
          py: 2,
          px: 2,
          borderRadius: 12,
          background: open ? 'surface' : 'transparent',
        }}
      >
        <PrincipalAvatar
          avatarConfig={profile.avatarConfig}
          principalId={profile.principalId}
          size={32}
          loading={profile.loading}
        />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="bodyBold"
            sx={{ color: 'text' }}
            numberOfLines={1}
            label={profile.displayLabel}
          />
        </Box>
        <IconSymbol name="ellipsis" size={18} color={theme.colors.icon} />
      </Pressable>
    </Box>
  );
}

export function SidebarAccountMenu() {
  const auth = useAuth();
  const profile = useProfile();
  const insets = useSafeAreaInsets();
  const triggerRef = useRef<ElementRef<typeof Box>>(null);
  const serverStatus = useServerStatus();
  const { refresh } = serverStatus;

  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

  useEffect(() => {
    if (open) refresh();
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

  const { onProfile, onSettings, onServerStatus, onAuth } =
    useAccountMenuActions({ auth, close });

  const menuContent = useMemo(
    () =>
      buildMenuContent({
        profile,
        auth,
        serverStatus,
        onProfile,
        onServerStatus,
        onAuth,
        onSettings,
      }),
    [
      profile,
      auth,
      serverStatus,
      onProfile,
      onServerStatus,
      onAuth,
      onSettings,
    ]
  );

  return (
    <>
      <AccountTrigger
        triggerRef={triggerRef}
        open={open}
        openMenu={openMenu}
        profile={profile}
      />
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
