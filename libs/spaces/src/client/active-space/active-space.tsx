import { Box } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { type ReactNode, useCallback, useContext, useState } from 'react';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';
import { RenameSpaceModal } from '../rename-space/rename-space-modal';
import { closeSpaceDetail } from '../space-routes';
import { ActiveSpaceBody } from './active-space-body';

const ZERO_SAFE_AREA = { top: 0, right: 0, bottom: 0, left: 0 };

/** Prefer context over the hook so Metro cannot bundle two copies of the library. */
function useSafeAreaBottom(): number {
  return (useContext(SafeAreaInsetsContext) ?? ZERO_SAFE_AREA).bottom;
}

export type ActiveSpaceProps = {
  spaceId: string;
};

/**
 * Wrapper around an active space session — body + rename confirmation modal.
 * End/leave confirms live in their slice modal providers so they stay mounted
 * through loading → success when membership changes.
 *
 * Top inset comes from {@link TopBar}'s `safeAreaTop` (same as ScreenBase);
 * bottom inset is applied here so content clears the home indicator on all
 * platforms — RN `SafeAreaView` only pads on iOS and left web flush.
 */
export function ActiveSpace({ spaceId }: ActiveSpaceProps): ReactNode {
  const router = useRouter();
  const bottomInset = useSafeAreaBottom();
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const [renameOpen, setRenameOpen] = useState(false);
  const onPressHome = useCallback(() => {
    closeSpaceDetail(router);
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
