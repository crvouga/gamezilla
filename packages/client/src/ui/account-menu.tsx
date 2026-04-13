import { useLogger } from '@gamezilla/shared/logger/react';
import {
  Box,
  FloatingMenu,
  Pressable,
  type FloatingMenuContent,
} from '@gamezilla/shared/ui';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useRef, useState, type ElementRef } from 'react';
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
          id: 'sign-in',
          label:
            auth.mode === 'signed-in' ? 'Sign out' : 'Sign in with Google',
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
    auth.mode,
    onAuth,
    onProfile,
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
