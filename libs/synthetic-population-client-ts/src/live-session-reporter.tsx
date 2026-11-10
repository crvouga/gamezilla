import { useConfigService } from '@libs/auth-client-ts/config-service-context';
import { useClientRequestAuth } from '@libs/auth-client-ts/use-client-request-auth';
import { useCurrentAccountId } from '@libs/auth-client-ts/use-current-account-id';
import { useDeviceId } from '@libs/auth-client-ts/use-device-id';
import { clientAuthHeaders } from '@libs/auth-shared-ts/client-request-auth';
import {
  LIVE_FRAME_INTERVAL_MS,
  LIVE_HEARTBEAT_MS,
} from '@libs/synthetic-population-shared-ts/live-session';
import { useClock, useTimers } from '@pkgs/clock-client-ts/solid';
import { useHttpClient } from '@pkgs/http-client-client-ts/solid';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useThemeHost } from '@pkgs/ui-root-client-ts/theme-context';
import {
  createEffect,
  createSignal,
  type JSX,
  on,
  onCleanup,
  untrack,
} from 'solid-js';
import { createLiveReport } from './live-report-client';
import { useLiveActivity } from './use-live-activity';

/** Whether one of this account's watch rows names this device, still running. */
function useWatchedHere(): () => boolean {
  const accountId = useCurrentAccountId();
  const deviceId = useDeviceId();
  const clock = useClock();
  const watches = createQuery(
    () => sql<{
      watched_until: string | null;
    }>`SELECT watched_until FROM population_live_watches
      WHERE account_id = ${accountId() ?? ''} AND device_id = ${deviceId()} AND deleted_at IS NULL`
  );
  return () => {
    const until = watches.rows()[0]?.watched_until;
    return until != null && new Date(until).getTime() > clock.now();
  };
}

function useLiveReportClient() {
  const config = useConfigService();
  const auth = useClientRequestAuth();
  const http = useHttpClient();
  const host = useThemeHost();
  return createLiveReport({
    root: host,
    baseUrl: config.getApiUrl(),
    fetch: http.fetch,
    headers: () => clientAuthHeaders(auth),
    secrets: () => [auth.sessionToken ?? ''],
  });
}

/**
 * Tells the server, on a heartbeat and whenever it moves, that this app is
 * online now and where; while someone watches it live, also sends what its
 * screen shows about once a second. Only this app's own data leaves it, and
 * never what was typed or marked private.
 */
function useLiveSessionReport(): void {
  const report = useLiveReportClient();
  const activity = useLiveActivity();
  const watchedHere = useWatchedHere();
  const timers = useTimers();
  const clock = useClock();
  const [watched, setWatched] = createSignal(false);
  let beat: unknown;
  let generation = 0;
  const heartbeat = async () => {
    timers.clearTimeout(beat);
    generation += 1;
    const mine = generation;
    const answer = await report.heartbeat(untrack(activity));
    if (mine !== generation) return;
    if (answer !== null) setWatched(answer.watched);
    beat = timers.setTimeout(() => void heartbeat(), LIVE_HEARTBEAT_MS);
  };
  createEffect(on(activity, () => void heartbeat()));
  createEffect(() => {
    if (watchedHere()) setWatched(true);
  });
  createEffect(() => {
    if (!watched()) return;
    const id = timers.setInterval(() => {
      void report.frame(clock.now()).then((kept) => {
        if (kept === false && !watchedHere()) setWatched(false);
      });
    }, LIVE_FRAME_INTERVAL_MS);
    void report.frame(clock.now());
    onCleanup(() => timers.clearInterval(id));
  });
  const leave = () => report.end();
  globalThis.addEventListener?.('pagehide', leave);
  onCleanup(() => {
    generation += 1;
    timers.clearTimeout(beat);
    globalThis.removeEventListener?.('pagehide', leave);
    void leave();
  });
}

/** Mounted for every app: a person's, or a Synthetic User's. */
export function LiveSessionReporter(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  useLiveSessionReport();
  return props.children;
}
