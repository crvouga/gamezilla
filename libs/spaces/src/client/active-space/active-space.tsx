import { Box, SafeAreaView } from '@pkgs/ui';
import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';

import { useSpaceLifecycleModals } from '../lifecycle/space-lifecycle-modal-provider';
import { ActiveSpaceBody } from './active-space-body';
import { RenameSpaceModal } from './rename-space-modal';

export type ActiveSpaceProps = {
  spaceId: string;
  onOpenDebug: () => void;
};

/**
 * Wrapper around an active space session — body + rename confirmation modal.
 * End/leave confirms live in {@link SpaceLifecycleModalProvider} so they stay
 * mounted through loading → success when membership changes.
 */
export function ActiveSpace({
  spaceId,
  onOpenDebug,
}: ActiveSpaceProps): ReactNode {
  const router = useRouter();
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
    <SafeAreaView sx={{ flex: 1, background: 'background' }}>
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
    </SafeAreaView>
  );
}
