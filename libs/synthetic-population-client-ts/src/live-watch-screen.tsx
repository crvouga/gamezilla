import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  LIVE_FRAME_CHANGED,
  LIVE_FRAME_INTERVAL_MS,
  LIVE_PRESENCE_CHANGED,
  LIVE_WATCH_LEASE_MS,
} from '@libs/synthetic-population-shared-ts/live-session';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useParams } from '@solidjs/router';
import {
  createEffect,
  createMemo,
  createResource,
  type JSX,
  onCleanup,
} from 'solid-js';
import {
  LiveWatchScreenView,
  type LiveWatchState,
} from './live-watch-screen-view';
import { resourceValue } from './resource-value';
import { useSyntheticPopulationApi } from './synthetic-population-api';
import {
  useRefreshWithoutUpdates,
  useSyntheticPopulationUpdates,
} from './use-synthetic-population-updates';

/** Looks again this often even when no new picture is announced. */
const KEEP_WATCHING_MS = LIVE_WATCH_LEASE_MS / 3;

function useLiveWatch(sessionId: () => string) {
  const api = useSyntheticPopulationApi();
  const timers = useTimers();
  const [read, { refetch }] = createResource(sessionId, (id) => api.watch(id));
  let lastUsername: string | null = null;
  const state = createMemo<LiveWatchState>(() => {
    const value = resourceValue(read);
    if (value === undefined)
      return read.error ? { kind: 'failed' } : { kind: 'loading' };
    if (!value.online) return { kind: 'offline', username: lastUsername };
    lastUsername = value.entry.username;
    return { kind: 'watching', entry: value.entry, frame: value.frame };
  });
  const watching = () => state().kind === 'watching';
  useSyntheticPopulationUpdates(
    () => (watching() ? refetch() : undefined),
    (notice) =>
      notice.type === LIVE_PRESENCE_CHANGED ||
      (notice.type === LIVE_FRAME_CHANGED && notice.sessionId === sessionId()),
    100
  );
  createEffect(() => {
    if (!watching()) return;
    const id = timers.setInterval(() => void refetch(), KEEP_WATCHING_MS);
    onCleanup(() => timers.clearInterval(id));
  });
  // Without live updates, look as often as the screen is sent.
  useRefreshWithoutUpdates(() => refetch(), LIVE_FRAME_INTERVAL_MS, watching);
  return { state, retry: () => void refetch() };
}

function LiveWatchContent(): JSX.Element {
  const params = useParams();
  const router = useRouter();
  const control = useCan(PERMISSION.syntheticPopulationControl);
  const watch = useLiveWatch(() => params['sessionId'] ?? '');
  return (
    <LiveWatchScreenView
      state={watch.state()}
      canControl={control()}
      onControlPanel={(id) =>
        router.push(`/admin/synthetic-population/users/${id}`)
      }
      onRetry={watch.retry}
      onBack={() => router.push('/admin/synthetic-population')}
    />
  );
}

/** `/admin/synthetic-population/live/:sessionId`: wires `LiveWatchScreenView`. */
export function LiveWatchScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.syntheticPopulationWatch);
  return (
    <DecisionGate
      decision={decision()}
      testId="synthetic-population-watch-denied"
      denied={(denial) => (
        <LiveWatchScreenView
          denial={denial}
          state={{ kind: 'loading' }}
          canControl={false}
          onControlPanel={() => undefined}
          onRetry={() => undefined}
          onBack={() => undefined}
        />
      )}
    >
      <LiveWatchContent />
    </DecisionGate>
  );
}
