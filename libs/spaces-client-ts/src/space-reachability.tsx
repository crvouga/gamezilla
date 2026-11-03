import { useTimers } from '@pkgs/clock-client-ts/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';
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
import { SpaceUnreachableScreenView } from './space-unreachable-screen-view';
import { useSpaceDisplayTitle } from './use-space-display-title';
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
  const title = useSpaceDisplayTitle(() => props.spaceId);
  return (
    <Show when={reach.unreachable()} fallback={props.children}>
      <SpaceUnreachableScreenView
        title={title()}
        onRetry={reach.tryAgain}
        onBackToSpaces={nav('/')}
      />
    </Show>
  );
}
