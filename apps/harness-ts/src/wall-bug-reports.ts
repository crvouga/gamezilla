// @io-wall-ok — browser composition root for bug reports
import { bootBrowserBugReports } from '@pkgs/feedback-client-ts/wall';
import type { HarnessCheckpoint } from '@pkgs/harness-console-shared-ts/checkpoint';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import {
  bugReportToReopen,
  fetchReportedWorld,
  type HarnessSessions,
  harnessContext,
  harnessSnapshotPort,
  type PreviewManifest,
  readPreviewManifest,
  searchAfterReopening,
} from './harness-bug-reports';

/**
 * Where bug reports go: the build names the team's intake (a Preview's is
 * the development environment's); otherwise the local one `bun run
 * dev:harness` serves.
 */
const ENDPOINT = import.meta.env.VITE_BUG_REPORT_URL || '/api/bug-reports';

const http = createGlobalHttpClient();

/**
 * Starts bug reporting in the harness, then the console. A bug report is
 * about the app on show and carries the whole in-tab world.
 */
export function bootHarnessBugReports(
  startConsole: (sessions: HarnessSessions) => Promise<void>
): void {
  const sessions: HarnessSessions = { current: null };
  let preview: PreviewManifest | null = null;
  void readPreviewManifest(http).then((manifest) => {
    preview = manifest;
  });
  const search = () => window.location.search;
  bootBrowserBugReports({
    endpoint: ENDPOINT,
    build: import.meta.env.VITE_COMMIT_HASH ?? 'unknown',
    http,
    snapshot: harnessSnapshotPort({ sessions, search }),
    // The apps in the tab each register their own; only the harness knows which is on show.
    context: () => [
      harnessContext({ sessions, search, preview: () => preview }),
    ],
    startApplication: () => startConsole(sessions),
  });
}

/**
 * The world of the bug report the address names, if it names one: read
 * back, with the address turned to the panel the reporter had on show.
 * `null` leaves the harness to open as it would have.
 */
export async function reopenReportedWorld(): Promise<HarnessCheckpoint | null> {
  const id = bugReportToReopen(window.location.search);
  if (id === null) return null;
  try {
    const world = await fetchReportedWorld({ http, endpoint: ENDPOINT, id });
    if (world === null) throw new Error('not a harness world');
    const { pathname, hash } = window.location;
    window.history.replaceState(
      window.history.state,
      '',
      `${pathname}${searchAfterReopening(window.location.search, world)}${hash}`
    );
    // The console reads its address again, as on back or forward.
    window.dispatchEvent(new PopStateEvent('popstate'));
    return world.checkpoint;
  } catch (error) {
    console.warn(`bug report ${id}: its world could not be reopened`, error);
    return null;
  }
}
