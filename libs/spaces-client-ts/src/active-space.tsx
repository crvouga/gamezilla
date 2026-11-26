import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from '@solidjs/web';
import { ActiveSpaceBody } from './active-space-body';
import { useRequestEndSpace } from './end-space-modal-provider';
import { useRequestLeaveSpace } from './leave-space-modal-provider';
import { closeSpaceDetail } from './space-routes';

export type ActiveSpaceProps = {
  spaceId: string;
};

/**
 * Wrapper around an active space session. Its chrome owns share, rename and
 * the people in it; end/leave confirms live in their slice modal providers
 * so they stay mounted through loading → success when membership changes.
 */
export function ActiveSpace(props: ActiveSpaceProps): JSX.Element {
  const router = useRouter();
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const onPressHome = (): void => {
    closeSpaceDetail(router);
  };

  return (
    <StackVertical grow testId={Handles.spaceActive}>
      <ActiveSpaceBody
        spaceId={props.spaceId}
        onRequestEnd={() => requestEndSpace(props.spaceId)}
        onRequestLeave={() => requestLeaveSpace(props.spaceId)}
        onPressHome={onPressHome}
      />
    </StackVertical>
  );
}
