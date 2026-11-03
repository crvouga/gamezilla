import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { useOptionalSoundEngine } from '@pkgs/sounds-client-ts/solid';
import { Sounds } from '@pkgs/sounds-shared-ts/sound-id';
import { useMutationFeedback } from '@pkgs/sync-engine-client-ts/use-mutation-feedback';
import type { MutationStateTransition } from '@pkgs/ui-root-client-ts/mutation-lifecycle';
import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { createSignal, Show } from 'solid-js';
import { useRequestLeaveSpace } from './leave-space-modal-provider';
import { SpaceEndedScreen } from './space-ended-screen';
import type { SpaceJoinStatus } from './space-join-screen-view';
import { SpaceJoinScreenView } from './space-join-screen-view';
import { useCheckConnection } from './use-check-connection';
import { useJoinSpace } from './use-join-space';
import { useSpaceCan } from './use-space-can';
import { useSpaceCardData } from './use-space-card-data';
import { useSpaceHostConnection } from './use-space-host-connection';
import { useSpaceJoinSnapshot } from './use-space-join-snapshot';

export type SpaceJoinPromptProps = {
  spaceId: string;
  /** The server has answered for this link (see `useSpaceByLink`). */
  linkAnswered: boolean;
};

/**
 * Joining needs the server: without one the prompt says so instead. A join
 * already waiting on confirmation is checked again without that test.
 */
function useJoinAction(spaceId: () => string, onOffline: () => void) {
  const { t } = useLingui();
  const joinSpace = useJoinSpace();
  const checkConnection = useCheckConnection();
  const engine = useOptionalSoundEngine();
  const persisted = useMutationFeedback('joinSpace', () => ({
    spaceId: spaceId(),
  }));
  return {
    pending: () => persisted()?.status === 'pending',
    join: async (): Promise<void> => {
      if (persisted()?.status !== 'pending' && !(await checkConnection())) {
        onOffline();
        throw new Error(t`Joining someone else's space needs a connection.`);
      }
      await joinSpace(spaceId());
    },
    onPhaseChange: (transition: MutationStateTransition): void => {
      const current = engine?.();
      if (current === undefined) return;
      if (transition.to === 'success') {
        current.play(Sounds.social.roomJoined);
      } else if (transition.to === 'error') {
        current.play(Sounds.feedback.error);
      }
    },
  };
}

/** `/space/:id` for a space the viewer is not in: wires `SpaceJoinScreenView`. */
export function SpaceJoinPrompt(props: SpaceJoinPromptProps): JSX.Element {
  const nav = useBreadcrumbNav();
  const snapshot = useSpaceJoinSnapshot(
    () => props.spaceId,
    () => props.linkAnswered
  );
  const [joinOffline, setJoinOffline] = createSignal(false);
  const connection = useSpaceHostConnection();
  const space = useSpaceCardData(() => props.spaceId);
  const canLeave = useSpaceCan(() => props.spaceId, PERMISSION.spacesLeave);
  const requestLeave = useRequestLeaveSpace();
  const join = useJoinAction(
    () => props.spaceId,
    () => setJoinOffline(true)
  );

  return (
    <Show
      when={snapshot().status !== 'ended'}
      fallback={<SpaceEndedScreen spaceId={props.spaceId} />}
    >
      <SpaceJoinScreenView
        title={space().title}
        status={snapshot().status as SpaceJoinStatus}
        connection={connection()}
        needsConnection={joinOffline() || connection() === 'offline'}
        space={space()}
        canLeave={canLeave()}
        joinPending={join.pending()}
        joinDisabled={props.spaceId.length === 0}
        onJoin={join.join}
        onJoinPhaseChange={join.onPhaseChange}
        onLeave={() => requestLeave(props.spaceId)}
        onBackToSpaces={nav('/')}
      />
    </Show>
  );
}
