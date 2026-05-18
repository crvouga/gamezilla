/**
 * Compact account menu trigger for {@link AppHeader}. Reuses the same
 * floating-menu rows the legacy sidebar exposed (Profile / Connection /
 * Sign in/out / Settings), but the trigger is a single circular avatar in
 * the header's trailing slot — Facebook-style.
 */

import {
  useSignInModal,
  useSignOutModal,
} from '@gamezilla/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@gamezilla/auth/client/use-current-user';
import { useServerStatus } from '@gamezilla/client/connection/use-server-status';
import { useAsync } from '@gamezilla/lib/async/use-async';
import { useLogger } from '@gamezilla/lib/logger/react';
import { MyDisplayName } from '@gamezilla/profile/client/my-display-name';
import { MyProfileAvatar } from '@gamezilla/profile/client/my-profile-avatar';
import {
  Box,
  FloatingMenu,
  Pressable,
  StatusDot,
  Text,
  type FloatingMenuContent,
} from '@gamezilla/ui';
import { t } from '@lingui/core/macro';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type ReactNode,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TRIGGER_SIZE = 40;

type AnchorRect = { x: number; y: number; width: number; height: number };
type ServerStatus = ReturnType<typeof useServerStatus>;

function useAccountMenuActions(args: {
  isAuthenticated: boolean;
  openSignOutConfirm: () => void;
  openSignInModal: () => void;
  close: () => void;
}) {
  const { isAuthenticated, openSignOutConfirm, openSignInModal, close } = args;
  const router = useRouter();
  const log = useLogger('app-account-menu');

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

  const onAuth = useCallback(() => {
    close();
    void runAuth().catch(() => {});
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

function buildAuthRow(isAuthenticated: boolean, onAuth: () => void): MenuRow {
  const label = isAuthenticated ? t`Sign out` : t`Sign in`;
  return {
    type: 'item',
    id: 'sign-in',
    label,
    icon: isAuthenticated ? 'arrow.right.from.bracket' : 'right.to.bracket',
    onPress: onAuth,
    accessibilityLabel: label,
  };
}

function buildMenuContent(args: {
  isAuthenticated: boolean;
  serverStatus: ServerStatus;
  onProfile: () => void;
  onServerStatus: () => void;
  onAuth: () => void;
  onSettings: () => void;
}): FloatingMenuContent {
  const {
    isAuthenticated,
    serverStatus,
    onProfile,
    onServerStatus,
    onAuth,
    onSettings,
  } = args;
  return {
    header: { title: <MyDisplayName variant="bodyBold" /> },
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
      buildAuthRow(isAuthenticated, onAuth),
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

function useFloatingAnchor(): {
  triggerRef: React.RefObject<ElementRef<typeof Box> | null>;
  open: boolean;
  anchor: AnchorRect | null;
  openMenu: () => void;
  close: () => void;
} {
  const triggerRef = useRef<ElementRef<typeof Box>>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<AnchorRect | null>(null);

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

  return { triggerRef, open, anchor, openMenu, close };
}

export function AppAccountMenu(): ReactNode {
  const isAuthenticated = useIsSignedIn();
  const { open: openSignInModal } = useSignInModal();
  const { open: openSignOutConfirm } = useSignOutModal();
  const insets = useSafeAreaInsets();
  const serverStatus = useServerStatus();
  const { refresh } = serverStatus;
  const { triggerRef, open, anchor, openMenu, close } = useFloatingAnchor();

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const { onProfile, onSettings, onServerStatus, onAuth } =
    useAccountMenuActions({
      isAuthenticated,
      openSignOutConfirm,
      openSignInModal,
      close,
    });

  const menuContent = useMemo(
    () =>
      buildMenuContent({
        isAuthenticated,
        serverStatus,
        onProfile,
        onServerStatus,
        onAuth,
        onSettings,
      }),
    [
      isAuthenticated,
      serverStatus,
      onProfile,
      onServerStatus,
      onAuth,
      onSettings,
    ]
  );

  return (
    <>
      <Box ref={triggerRef} collapsable={false}>
        <Pressable
          onPress={openMenu}
          accessibilityRole="button"
          accessibilityLabel={t`User menu`}
          accessibilityState={{ expanded: open }}
          sx={{
            width: TRIGGER_SIZE,
            height: TRIGGER_SIZE,
            borderRadius: TRIGGER_SIZE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            background: open ? 'surface' : 'transparent',
          }}
        >
          <MyProfileAvatar size={TRIGGER_SIZE - 4} />
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
