import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import {
  type Accessor,
  batch,
  createEffect,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { SpaceTitleText } from './space-title-text';
import { useSpaceRoomSelector } from './use-space-room-selector';

/**
 * How long a device with a connection waits for its space before saying the
 * space can't be reached. The space's own copy on the device shows meanwhile.
 */
export const SPACE_REACH_WAIT_MS = 10_000;

type SpaceReach = {
  readonly unreachable: Accessor<boolean>;
  readonly tryAgain: () => void;
};

/**
 * Whether the space has failed to answer for {@link SPACE_REACH_WAIT_MS}
 * while the device had a connection. Without one the device keeps using its
 * own copy, as a host does offline; once the space answers, it is reachable
 * again. Trying again waits afresh.
 */
export function useSpaceReach(): SpaceReach {
  const timers = useTimers();
  const engine = useSyncEngine();
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const [unreachable, setUnreachable] = createSignal(false);
  const [attempt, setAttempt] = createSignal(0);
  createEffect(() => {
    attempt();
    if (synced()) {
      setUnreachable(false);
      return;
    }
    if (!engine.status().online || untrack(unreachable)) return;
    const timer = timers.setTimeout(
      () => setUnreachable(true),
      SPACE_REACH_WAIT_MS
    );
    onCleanup(() => timers.clearTimeout(timer));
  });
  return {
    unreachable,
    tryAgain: () =>
      batch(() => {
        setUnreachable(false);
        setAttempt((n) => n + 1);
      }),
  };
}

/**
 * The space, or — when it can't be reached — word of that with Try again
 * and the way back to Spaces, so nobody waits on a space without end.
 */
export function ReachableSpace(props: {
  readonly spaceId: string;
  readonly children: JSX.Element;
}): JSX.Element {
  const reach = useSpaceReach();
  const nav = useBreadcrumbNav();
  const { t } = useLingui();
  return (
    <Show when={reach.unreachable()} fallback={props.children}>
      <ContentScreen
        screenId="space-unreachable"
        breadcrumbs={[
          { name: <Trans>Spaces</Trans>, onClick: nav('/') },
          { name: <SpaceTitleText spaceId={props.spaceId} /> },
        ]}
      >
        <ErrorState
          title={t`This space can't be reached right now`}
          body={t`It may no longer exist. Try again, or go back to Spaces.`}
          retry={{
            label: t`Try again`,
            onClick: reach.tryAgain,
            dataSet: { testid: Handles.spaceUnreachableRetry },
          }}
          secondary={{
            label: t`Back to Spaces`,
            onClick: nav('/'),
            dataSet: { testid: Handles.spaceUnreachableBack },
          }}
          dataSet={{ testid: Handles.spaceUnreachable }}
        />
      </ContentScreen>
    </Show>
  );
}
