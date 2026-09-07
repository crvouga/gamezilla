import { Box, useRouter } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createSignal } from 'solid-js';
import { closeSpaceDetail } from '../../../public/space-routes';
import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';
import { RenameSpaceModal } from '../rename-space/rename-space-modal';
import { ActiveSpaceBody } from './active-space-body';

export type ActiveSpaceProps = {
  spaceId: string;
};

/**
 * Wrapper around an active space session — body + rename confirmation modal.
 * End/leave confirms live in their slice modal providers so they stay mounted
 * through loading → success when membership changes.
 *
 * Top inset comes from {@link TopBar}'s `safeAreaTop` (same as ScreenBase);
 * the web shell has no home-indicator inset, so the body runs flush.
 */
export function ActiveSpace(props: ActiveSpaceProps): JSX.Element {
  const router = useRouter();
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const [renameOpen, setRenameOpen] = createSignal(false);
  const onPressHome = (): void => {
    closeSpaceDetail(router);
  };

  return (
    <Box sx={{ flex: 1, background: 'background' }}>
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <ActiveSpaceBody
          spaceId={props.spaceId}
          onRequestEnd={() => requestEndSpace(props.spaceId)}
          onRequestLeave={() => requestLeaveSpace(props.spaceId)}
          onRequestRename={() => setRenameOpen(true)}
          onPressHome={onPressHome}
        />
        <RenameSpaceModal
          spaceId={props.spaceId}
          visible={renameOpen()}
          onClose={() => setRenameOpen(false)}
        />
      </Box>
    </Box>
  );
}
