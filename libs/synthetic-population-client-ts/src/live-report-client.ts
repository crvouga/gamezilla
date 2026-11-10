import type { SyntheticPopulationLiveRPC } from '@libs/synthetic-population-server-ts/live-routes';
import { sanitizeDomSnapshot } from '@libs/synthetic-population-shared-ts/inspection';
import type {
  LiveHeartbeat,
  LiveHeartbeatAnswer,
} from '@libs/synthetic-population-shared-ts/live-session';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { hc } from 'hono/client';

export type LiveReportOptions = {
  readonly baseUrl: string;
  readonly fetch: HttpFetch;
  readonly headers: () => Record<string, string>;
  /** Credentials to blank out of any picture of the screen. */
  readonly secrets: () => readonly string[];
  /** The element the app draws itself in; its whole document otherwise. */
  readonly root?: () => Element | undefined;
};

/** What the screen shows now, sanitized; `null` without a document. */
function captureScreen(
  options: LiveReportOptions,
  capturedAtMs: number
): { html: string; capturedAtMs: number } | null {
  const source =
    options.root?.() ?? (globalThis as { document?: Document }).document;
  if (source === undefined) return null;
  return {
    html: sanitizeDomSnapshot(source, options.secrets(), 'screen').html,
    capturedAtMs,
  };
}

/**
 * The app's side of the live-session telemetry. Every call is best effort:
 * a report that cannot be delivered is dropped, and the next heartbeat
 * says the same again.
 */
export function createLiveReport(options: LiveReportOptions) {
  const rpc = hc<SyntheticPopulationLiveRPC>(
    `${options.baseUrl.replace(/\/$/, '')}/api/synthetic-population-live`,
    { fetch: options.fetch, headers: options.headers }
  );
  return {
    async heartbeat(value: LiveHeartbeat): Promise<LiveHeartbeatAnswer | null> {
      try {
        const response = await rpc.heartbeat.$post({ json: value });
        return response.status === 200 ? await response.json() : null;
      } catch {
        return null;
      }
    },
    async frame(capturedAtMs: number): Promise<boolean | null> {
      const frame = captureScreen(options, capturedAtMs);
      if (frame === null) return null;
      try {
        const response = await rpc.frame.$post({ json: frame });
        return response.status === 200 ? (await response.json()).kept : null;
      } catch {
        return null;
      }
    },
    async end(): Promise<void> {
      try {
        await rpc.end.$post();
      } catch {
        // Not online now any more either way: the heartbeat stops.
      }
    },
  };
}
