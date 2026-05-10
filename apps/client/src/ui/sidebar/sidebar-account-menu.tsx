/**
 * Wide-layout sidebar account row + {@link FloatingMenu} (same entries as
 * header overflow). Pure layout — composes id-driven atoms for the trigger
 * (avatar + name) and the menu header.
 */

import { useAuth } from '@gamezilla/auth/client/auth-context';
import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useLogger } from '@gamezilla/client/runtime/runtime-hooks';
import { SidebarAccountMenuHeader } from '@gamezilla/client/ui/sidebar/sidebar-account-menu-header';
import { SidebarAccountTrigger } from '@gamezilla/client/ui/sidebar/sidebar-account-trigger';
import { useAsync } from '@gamezilla/lib/async/use-async';
import {
  Box,
  FloatingMenu,
  StatusDot,
  Text,
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

type AnchorRect = { x: number; y: number; width: number; height: number };

type Auth = ReturnType<typeof useAuth>;
type ServerStatus = ReturnType<typeof useServerStatus>;

function useAccountMenuActions(args: { auth: Auth; close: () => void }) {
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

  const onAuth = useCallback(() => {
    close();
    void runAuth().catch(() => {
      // onError already logged via hook.
    });
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
  const ms = health.latencyMs;
  const label =
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
      <Text variant="caption" sx={{ color: 'textSecondary' }} label={label} />
    </Box>
  );
}

function aggregateStatusWord(s: ServerStatus['aggregateStatus']): string {
  if (s === 'online') return t`Online`;
  if (s === 'offline') return t`Offline`;
  return t`Limited or checking`;
}

function latencyPhrase(health: ServerStatus['health']): string {
  if (health.phase === 'loading') return t`latency checking`;
  const ms = health.latencyMs;
  if (ms !== null) return t`latency ${ms} ms`;
  return t`latency unavailable`;
}

type MenuRow = FloatingMenuContent['rows'][number];

function buildConnectionRow(args: {
  serverStatus: ServerStatus;
  onServerStatus: () => void;
}): MenuRow {
  const { serverStatus, onServerStatus } = args;
  const { aggregateStatus, health } = serverStatus;
  const statusWord = aggregateStatusWord(aggregateStatus);
  const latency = latencyPhrase(health);
  const accLabel = t`Connection and server status. ${statusWord}. ${latency}.`;
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
  const label = auth.isAuthenticated ? t`Sign out` : t`Sign in`;
  return {
    type: 'item',
    id: 'sign-in',
    label,
    icon: auth.isAuthenticated
      ? 'arrow.right.from.bracket'
      : 'right.to.bracket',
    onPress: onAuth,
    accessibilityLabel: label,
  };
}

function buildMenuContent(args: {
  auth: Auth;
  serverStatus: ServerStatus;
  onProfile: () => void;
  onServerStatus: () => void;
  onAuth: () => void;
  onSettings: () => void;
}): FloatingMenuContent {
  const { auth, serverStatus, onProfile, onServerStatus, onAuth, onSettings } =
    args;
  return {
    header: { title: <SidebarAccountMenuHeader /> },
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

export function SidebarAccountMenu() {
  const auth = useAuth();
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
        auth,
        serverStatus,
        onProfile,
        onServerStatus,
        onAuth,
        onSettings,
      }),
    [auth, serverStatus, onProfile, onServerStatus, onAuth, onSettings]
  );

  return (
    <>
      <SidebarAccountTrigger
        triggerRef={triggerRef}
        open={open}
        onPress={openMenu}
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
