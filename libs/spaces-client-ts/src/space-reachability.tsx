import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';
import type { JSX } from '@solidjs/web';
import {
  type Accessor,
  createEffect,
  createSignal,
  Show,
  untrack,
} from 'solid-js';
import { useSpaceRoomAdmission } from './space-room-admission';
import { SpaceUnreachableScreenView } from './space-unreachable-screen-view';
import { useSpaceDisplayTitle } from './use-space-display-title';
import { useSpaceRoomSelector } from './use-space-room-selector';

/**
 * How long a device with a connection waits for its space before asking the
 * room gateway whether the space's room will take it. The space's own copy
 * on the device shows meanwhile.
 */
export const SPACE_REACH_WAIT_MS = 10_000;

/**
 * How often a device whose space still has not answered asks again, while
 * the gateway does not refuse it (a room reconnecting, a session being
 * renewed, a server restarting).
 */
export const SPACE_REACH_RECHECK_MS = 30_000;

type SpaceReach = {
  readonly unreachable: Accessor<boolean>;
  readonly tryAgain: () => void;
};

/**
 * Whether the space can't be reached: its room has not answered for
 * {@link SPACE_REACH_WAIT_MS} while the device had a connection, and the
 * room gateway then refused the device. Silence alone is never enough: a
 * room socket reconnecting on its backoff, a session being renewed or a
 * server restarting all leave the room quiet for a while, and the space is
 * still there, so the device keeps its own copy and asks again every
 * {@link SPACE_REACH_RECHECK_MS}. Without a connection the device keeps using
 * its own copy, as a host does offline; once the space answers, it is
 * reachable again. Trying again waits afresh.
 */
export function useSpaceReach(spaceId: Accessor<string>): SpaceReach {
  const timers = useTimers();
  const engine = useSyncEngine();
  const logger = useLogger('space-room');
  const askAdmission = useSpaceRoomAdmission(spaceId);
  const synced = useSpaceRoomSelector(RoomMetaAttr.isSynced.from);
  const [unreachable, setUnreachable] = createSignal(false);
  const [attempt, setAttempt] = createSignal(0);
  const ask = async (asks: number): Promise<'refused' | 'ask-again'> => {
    const admission = await askAdmission();
    const context = {
      spaceId: untrack(spaceId),
      asks,
      waitedMs: SPACE_REACH_WAIT_MS + (asks - 1) * SPACE_REACH_RECHECK_MS,
    };
    // regression: space-unreachable-while-room-reconnects
    if (admission.verdict === 'refused') {
      logger.warn('Space declared unreachable', {
        ...context,
        reason: admission.reason,
      });
      return 'refused';
    }
    logger.info('Space room not answering yet; not refused', {
      ...context,
      verdict: admission.verdict,
      ...(admission.verdict === 'unknown' ? { reason: admission.reason } : {}),
    });
    return 'ask-again';
  };
  createEffect(
    (): 'synced' | 'offline' | 'waiting' => {
      attempt();
      if (synced()) return 'synced';
      return engine.status().online ? 'waiting' : 'offline';
    },
    (state) => {
      if (state === 'synced') {
        setUnreachable(false);
        return;
      }
      // Read once: declaring the space unreachable must not start a new wait.
      if (state === 'offline' || untrack(unreachable)) return;
      let live = true;
      let asks = 0;
      const askNow = async (): Promise<void> => {
        asks += 1;
        const answer = await ask(asks);
        if (!live) return;
        if (answer === 'refused') {
          setUnreachable(true);
          return;
        }
        timer = timers.setTimeout(() => void askNow(), SPACE_REACH_RECHECK_MS);
      };
      let timer = timers.setTimeout(() => void askNow(), SPACE_REACH_WAIT_MS);
      return () => {
        live = false;
        timers.clearTimeout(timer);
      };
    }
  );
  return {
    unreachable,
    tryAgain: () => {
      setUnreachable(false);
      setAttempt((n) => n + 1);
    },
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
  const reach = useSpaceReach(() => props.spaceId);
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
