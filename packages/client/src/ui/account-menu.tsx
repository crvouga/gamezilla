import {
  Avatar,
  Box,
  FloatingMenu,
  Pressable,
  type FloatingMenuContent,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ElementRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/auth-context';

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
  const router = useRouter();
  const auth = useAuth();
  const insets = useSafeAreaInsets();
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

  const onProfile = useCallback(() => {
    close();
    router.push('/profile');
  }, [close, router]);

  const onSettings = useCallback(() => {
    close();
    router.push('/more');
  }, [close, router]);

  const menuContent = useMemo((): FloatingMenuContent => {
    return {
      header: {
        title: auth.displayName,
        subtitle: auth.mode === 'guest' ? 'Guest' : 'Signed in',
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
          id: 'sign-in',
          label: 'Sign in',
          disabled: true,
          accessibilityLabel: 'Sign in',
        },
        {
          type: 'item',
          id: 'create-account',
          label: 'Create account',
          disabled: true,
          accessibilityLabel: 'Create account',
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
  }, [auth.displayName, auth.mode, onProfile, onSettings]);

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
          <Avatar
            initials={auth.displayName.slice(0, 2)}
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
