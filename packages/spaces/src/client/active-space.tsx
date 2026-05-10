import { ActiveSpaceBody } from './active-space-body';
import { EndSpaceModal } from './end-space-modal';
import { LeaveSpaceModal } from './leave-space-modal';
import { Box, SafeAreaView } from '@gamezilla/ui';
import { useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';

export type ActiveSpaceProps = {
  spaceId: string;
  onOpenDebug: () => void;
};

/**
 * Wrapper around an active space session — body + end/leave confirmation
 * modals. Pure layout + local UI state. The room provider is hoisted to the
 * screen level so room state is observable from the debug modal too.
 */
export function ActiveSpace({
  spaceId,
  onOpenDebug,
}: ActiveSpaceProps): ReactNode {
  const router = useRouter();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const onPressHome = useCallback(() => {
    router.replace('/');
  }, [router]);

  return (
    <SafeAreaView sx={{ flex: 1, background: 'background' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ActiveSpaceBody
          spaceId={spaceId}
          onRequestEnd={() => setConfirmEnd(true)}
          onRequestLeave={() => setConfirmLeave(true)}
          onPressHome={onPressHome}
          onPressDebug={onOpenDebug}
        />
        <EndSpaceModal
          spaceId={spaceId}
          visible={confirmEnd}
          onClose={() => setConfirmEnd(false)}
        />
        <LeaveSpaceModal
          spaceId={spaceId}
          visible={confirmLeave}
          onClose={() => setConfirmLeave(false)}
        />
      </Box>
    </SafeAreaView>
  );
}
