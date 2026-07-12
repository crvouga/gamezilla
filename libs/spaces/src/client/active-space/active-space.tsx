import { Box } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { useCallback, useContext, useState, type ReactNode } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useSpaceLifecycleModals } from '../lifecycle/space-lifecycle-modal-provider';
import { ActiveSpaceBody } from './active-space-body';
import { RenameSpaceModal } from './rename-space-modal';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Prefer context over the hook so Metro cannot bundle two copies of the library. */
function useSafeAreaBottom(): number {
  return (useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA).bottom;
}

export type ActiveSpaceProps = {
  spaceId: string;
  onOpenDebug: () => void;
};

/**
 * Wrapper around an active space session — body + rename confirmation modal.
 * End/leave confirms live in {@link SpaceLifecycleModalProvider} so they stay
 * mounted through loading → success when membership changes.
 *
 * Top inset comes from {@link TopBar}'s `safeAreaTop` (same as ScreenBase);
 * bottom inset is applied here so content clears the home indicator on all
 * platforms — RN `SafeAreaView` only pads on iOS and left web flush.
 */
export function ActiveSpace({
  spaceId,
  onOpenDebug,
}: ActiveSpaceProps): ReactNode {
  const router = useRouter();
  const bottomInset = useSafeAreaBottom();
  const { requestEndSpace, requestLeaveSpace } = useSpaceLifecycleModals();
  const [renameOpen, setRenameOpen] = useState(false);
  const onPressHome = useCallback(() => {
    router.replace('/');
  }, [router]);
  const onRequestEnd = useCallback(() => {
    requestEndSpace(spaceId);
  }, [requestEndSpace, spaceId]);
  const onRequestLeave = useCallback(() => {
    requestLeaveSpace(spaceId);
  }, [requestLeaveSpace, spaceId]);

  return (
    <Box
      sx={{ flex: 1, background: 'background' }}
      style={{ paddingBottom: bottomInset }}
    >
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ActiveSpaceBody
          spaceId={spaceId}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
          onRequestRename={() => setRenameOpen(true)}
          onPressHome={onPressHome}
          onPressDebug={onOpenDebug}
        />
        <RenameSpaceModal
          spaceId={spaceId}
          visible={renameOpen}
          onClose={() => setRenameOpen(false)}
        />
      </Box>
    </Box>
  );
}
