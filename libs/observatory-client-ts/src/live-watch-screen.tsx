import {
  LIVE_FRAME_CHANGED,
  LIVE_FRAME_INTERVAL_MS,
  LIVE_PRESENCE_CHANGED,
  LIVE_WATCH_LEASE_MS,
} from '@libs/observatory-shared-ts/live-session';
import {
  ONLINE_NOW_PATH,
  syntheticUserPath,
} from '@libs/observatory-shared-ts/observatory-routes';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useCan, useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useRouter } from '@pkgs/ui-root-client-ts/app-router';
import { useParams } from '@solidjs/router';
import type { JSX } from '@solidjs/web';
import { createEffect, createMemo } from 'solid-js';
import { createLiveRead } from './live-read';
import {
  LiveWatchScreenView,
  type LiveWatchState,
} from './live-watch-screen-view';
import { useObservatoryApi } from './observatory-api';
import {
  useObservatoryUpdates,
  useRefreshWithoutUpdates,
} from './use-observatory-updates';

/** Looks again this often even when no new picture is announced. */
const KEEP_WATCHING_MS = LIVE_WATCH_LEASE_MS / 3;

function useLiveWatch(sessionId: () => string) {
  const api = useObservatoryApi();
  const timers = useTimers();
  // Without a connection, the last known screen stays in view.
  const read = createLiveRead(
    () => sessionId() || undefined,
    (id) => api.watch(id)
  );
  let lastUsername: string | null = null;
  const state = createMemo<LiveWatchState>(() => {
    const value = read.shown();
    if (value === undefined)
      return read.failed() ? { kind: 'failed' } : { kind: 'loading' };
    if (!value.online) return { kind: 'offline', username: lastUsername };
    lastUsername = value.entry.username;
    return { kind: 'watching', entry: value.entry, frame: value.frame };
  });
  const watching = () => state().kind === 'watching';
  useObservatoryUpdates(
    () => (watching() ? read.reread() : undefined),
    (notice) =>
      notice.type === LIVE_PRESENCE_CHANGED ||
      (notice.type === LIVE_FRAME_CHANGED && notice.sessionId === sessionId()),
    100
  );
  // Every read restarts the wait, so this only looks when nothing else did.
  createEffect(watching, (on) => {
    if (!on) return;
    const id = timers.setInterval(() => void read.reread(), KEEP_WATCHING_MS);
    return () => timers.clearInterval(id);
  });
  // Without live updates, look as often as the screen is sent.
  useRefreshWithoutUpdates(read.reread, LIVE_FRAME_INTERVAL_MS, watching);
  return { state, retry: () => void read.reread() };
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
      onControlPanel={(id) => router.push(syntheticUserPath(id))}
      onRetry={watch.retry}
      onBack={() => router.push(ONLINE_NOW_PATH)}
    />
  );
}

/** `/admin/observatory/live/:sessionId`: wires `LiveWatchScreenView`. */
export function LiveWatchScreen(): JSX.Element {
  const decision = useDecision(PERMISSION.observatoryWatch);
  return (
    <DecisionGate
      decision={decision()}
      testId="observatory-watch-denied"
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
