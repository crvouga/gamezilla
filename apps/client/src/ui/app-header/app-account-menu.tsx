/**
 * Compact account menu trigger for {@link AppHeader}. Standard user-menu items
 * (Account / Settings / Sign in or out) anchored on the header avatar.
 */

import {
  useSignInModal,
  useSignOutModal,
} from '@libs/auth/client/auth-modals-provider';
import { useIsSignedIn } from '@libs/auth/client/use-current-user';
import { useAsync } from '@pkgs/async/use-async';
import { useLogger } from '@pkgs/logger/react';
import { MyDisplayName } from '@libs/profile/client/my-display-name';
import { MyProfileAvatar } from '@libs/profile/client/my-profile-avatar';
import {
  Box,
  FloatingMenu,
  Pressable,
  type FloatingMenuContent,
} from '@pkgs/ui';
import { t } from '@lingui/core/macro';
import { useRouter } from 'expo-router';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ElementRef,
  type ReactNode,
} from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TRIGGER_SIZE = 40;

type AnchorRect = { x: number; y: number; width: number; height: number };

function useAccountMenuActions(args: {
  isAuthenticated: boolean;
  openSignOutConfirm: () => void;
  openSignInModal: () => void;
  close: () => void;
}) {
  const { isAuthenticated, openSignOutConfirm, openSignInModal, close } = args;
  const router = useRouter();
  const log = useLogger('app-account-menu');

  const onAccount = useCallback(() => {
    close();
    router.push('/more/account');
  }, [close, router]);

  const onSettings = useCallback(() => {
    close();
    router.push('/more');
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

  return { onAccount, onSettings, onAuth };
}

type MenuRow = FloatingMenuContent['rows'][number];

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
  onAccount: () => void;
  onAuth: () => void;
  onSettings: () => void;
}): FloatingMenuContent {
  const { isAuthenticated, onAccount, onAuth, onSettings } = args;
  return {
    header: { title: <MyDisplayName variant="bodyBold" /> },
    rows: [
      {
        type: 'item',
        id: 'account',
        label: t`Account`,
        icon: 'person.fill',
        onPress: onAccount,
        accessibilityLabel: t`Account`,
      },
      {
        type: 'item',
        id: 'settings',
        label: t`Settings`,
        icon: 'gearshape.fill',
        onPress: onSettings,
        accessibilityLabel: t`Settings`,
      },
      { type: 'divider', id: 'before-auth' },
      buildAuthRow(isAuthenticated, onAuth),
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
  const { triggerRef, open, anchor, openMenu, close } = useFloatingAnchor();

  const { onAccount, onSettings, onAuth } = useAccountMenuActions({
    isAuthenticated,
    openSignOutConfirm,
    openSignInModal,
    close,
  });

  const menuContent = useMemo(
    () =>
      buildMenuContent({
        isAuthenticated,
        onAccount,
        onAuth,
        onSettings,
      }),
    [isAuthenticated, onAccount, onAuth, onSettings]
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
