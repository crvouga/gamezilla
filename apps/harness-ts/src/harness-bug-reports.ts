/**
 * Bug reports from the harness: each one is about the app on show and
 * carries the whole in-tab world, so whoever fixes the bug reopens the
 * world as it was (`?bug-report=<id>`).
 */

import type { SnapshotPort } from '@pkgs/feedback-client-ts/ports';
import { BUG_REPORT_ID } from '@pkgs/feedback-shared-ts/bug-report';
import type { DiagnosticProvider } from '@pkgs/feedback-shared-ts/types';
import {
  harnessEmulatorPanelId,
  harnessPanels,
  resolveHarnessView,
  shownHarnessClient,
} from '@pkgs/harness-console-shared-ts/harness-windows';
import type { ProductHarnessSession } from '@pkgs/harness-console-shared-ts/ports';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { z } from 'zod';
import { buildConsoleSearch, parseConsoleNav } from './console-nav';
import {
  decodeHarnessWorld,
  encodeHarnessWorld,
  HARNESS_WORLD_TYPE,
  type HarnessWorld,
} from './product-harness-world';

/** The address parameter that reopens the world a bug report carries. */
export const REOPEN_BUG_REPORT_PARAM = 'bug-report';

/** The session the console booted, once it has. */
export type HarnessSessions = { current: ProductHarnessSession | null };

/** What `preview.json` says of a Preview: its name and the commit it was built from. */
export type PreviewManifest = {
  readonly preview: string;
  readonly commit: string;
};

const manifestSchema = z.object({
  preview: z.string().regex(/^[a-z0-9-]{1,63}$/),
  commit: z.string().regex(/^[0-9a-f]{7,40}$/),
});

/** The Preview this page is, or `null` off a Preview. */
export async function readPreviewManifest(
  http: HttpClient
): Promise<PreviewManifest | null> {
  try {
    const response = await http.fetch('/preview.json');
    if (!response.ok) return null;
    const parsed = manifestSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The panel on show, as the console resolves it from its address. */
function shownPanel(
  session: ProductHarnessSession,
  search: string
): string | null {
  const panels = [
    ...harnessPanels({
      clients: [...session.clients.keys()],
      servers: [...session.servers.keys()],
      rooms: [...session.rooms.keys()],
    }).map((panel) => panel.id),
    ...session.emulators.map((emulator) => harnessEmulatorPanelId(emulator.id)),
  ];
  return resolveHarnessView(parseConsoleNav(search).show, panels);
}

/** Only where the app is: a query can hold what a person typed. */
function pathOnly(href: string): string {
  return href.split(/[?#]/)[0] ?? '';
}

function clientPath(
  session: ProductHarnessSession,
  client: string | null
): string | null {
  const view = client === null ? null : session.clients.get(client)?.view;
  return view?.kind === 'solid' ? pathOnly(view.history.get()) : null;
}

/**
 * What a bug report tells of the harness: the Preview and commit, the panel
 * on show and, when it is a client's, which client and where its app is.
 */
export function harnessContext(args: {
  readonly sessions: HarnessSessions;
  readonly search: () => string;
  readonly preview: () => PreviewManifest | null;
}): DiagnosticProvider {
  return {
    name: 'harness',
    collect: () => {
      const session = args.sessions.current;
      if (session === null) return { preview: args.preview(), booted: false };
      const shown = shownPanel(session, args.search());
      const client = shownHarnessClient(shown);
      return {
        preview: args.preview(),
        booted: true,
        shown,
        client,
        clientPath: clientPath(session, client),
        clients: [...session.clients.keys()],
        servers: [...session.servers.keys()],
        clockMs: session.clock.now(),
        clockPaused: session.isClockPaused(),
      };
    },
  };
}

/** The console's own part of an address: the panel on show and each panel's view. */
function consoleSearch(search: string): string {
  return buildConsoleSearch(parseConsoleNav(search));
}

/** A snapshot of the whole in-tab world, with the panel on show. */
export function harnessSnapshotPort(args: {
  readonly sessions: HarnessSessions;
  readonly search: () => string;
}): SnapshotPort {
  return {
    async capture() {
      const session = args.sessions.current;
      if (session === null) return null;
      const search = consoleSearch(args.search());
      const checkpoint = await session.captureCheckpoint('bug report');
      return {
        contentType: HARNESS_WORLD_TYPE,
        bytes: await encodeHarnessWorld({ checkpoint, search }),
      };
    },
  };
}

/** The bug report whose world the address asks to reopen, if any. */
export function bugReportToReopen(search: string): string | null {
  const id = new URLSearchParams(search).get(REOPEN_BUG_REPORT_PARAM);
  return id !== null && BUG_REPORT_ID.test(id) ? id : null;
}

/** The world a bug report carries, read back from the team's archive. */
export async function fetchReportedWorld(args: {
  readonly http: HttpClient;
  /** Where bug reports are sent (`…/api/bug-reports`). */
  readonly endpoint: string;
  readonly id: string;
}): Promise<HarnessWorld | null> {
  const response = await args.http.fetch(
    `${args.endpoint}/reports/${args.id}/snapshot`
  );
  if (!response.ok) {
    await response.body?.cancel();
    return null;
  }
  return decodeHarnessWorld(new Uint8Array(await response.arrayBuffer()));
}

/**
 * The address once the world is reopened: the panel the reporter had on
 * show, and no request to reopen it again.
 */
export function searchAfterReopening(
  search: string,
  world: HarnessWorld
): string {
  const params = new URLSearchParams(search);
  params.delete(REOPEN_BUG_REPORT_PARAM);
  return buildConsoleSearch(parseConsoleNav(world.search), params.toString());
}
