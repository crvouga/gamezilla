import { createReportsApp } from '@libs/app-root-server/reports-route';
import { pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import type { ReportNavigation } from '@pkgs/harness-report-client/navigation';
import { RemoteReportsApp } from '@pkgs/harness-report-client/remote-reports-app';
import { performancePart } from '@pkgs/harness-report-shared/performance-part';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@pkgs/harness-report-shared/publish';
import { publishPart } from '@pkgs/harness-report-shared/report-parts';
import {
  publishInventory,
  readInventory,
} from '@pkgs/harness-report-shared/spec-inventory';
import { createHonoHttpClient } from '@pkgs/http-client-shared/hono-http-client';
import { OverlayPortalProvider } from '@pkgs/ui-root-client/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { catalogSource } from './developer-catalog-source';
import { recordedReport, reportMeta } from './developer-report';
import { tools } from './developer-tools-state';

const SHA = '1111111111111111111111111111111111111111';
const LATER = '2222222222222222222222222222222222222222';
const PATH = 'specs/friends/accept.feature';
const CONTENT =
  'Feature: Accept a friend request\n  Scenario: A friend request becomes a friendship\n    Then Alice and Bob are friends\n';
type ExplorerFixture = {
  kind: string;
  available: boolean;
  host: HTMLElement | null;
  dispose: (() => void) | null;
};
const sessions = new WeakMap<ProductHarness, ExplorerFixture>();
function fixture(s: ProductHarness): ExplorerFixture {
  const state = sessions.get(s);
  if (!state) throw new Error('Explorer fixture missing');
  return state;
}

function navigation(): ReportNavigation {
  let hash = '#/';
  return {
    readHash: () => hash,
    writeHash: (next) => {
      hash = next;
    },
    subscribeHash: () => () => undefined,
    subscribeKeys: () => () => undefined,
    setTitle: () => undefined,
  };
}

async function seedExplorer(s: ProductHarness, kind: string): Promise<void> {
  sessions.set(s, {
    kind,
    available: kind !== 'unavailable' && kind !== 'recovered',
    host: null,
    dispose: null,
  });
  const store = tools(s).reportStore;
  await publishInventory(store, {
    sha: SHA,
    documents: [{ path: PATH, content: CONTENT }],
  });
  await openCommit(store, {
    sha: SHA,
    branch: 'investigation',
    runUrl: null,
    startedAtMs: 0,
    frameCss: '',
  });
  if (kind !== 'missing')
    await publishSource(store, {
      sha: SHA,
      packageDir: 'investigation',
      bucket: 'completed',
      local: await catalogSource([
        {
          ...reportMeta('Alice accepts a friend request'),
          testId: 'completed',
          sourceFile: PATH,
        },
      ]),
    });
  await closeCommit(store, { sha: SHA, endedAtMs: 300 });
  if (kind === 'quality')
    await publishPart(store, {
      sha: SHA,
      id: 'quality',
      kind: 'ui-quality',
      title: 'UI quality',
      recordedAtMs: 400,
      checks: [
        {
          id: 'quality',
          title: 'Friend request presentation',
          status: 'passed',
          detail: 'Recorded UI quality',
          measurements: [{ name: 'Visual quality', value: 0.8, unit: 'score' }],
        },
      ],
    });
  if (kind === 'performance' || kind === 'foreign') {
    const report = recordedReport('current').report;
    await publishPart(
      store,
      performancePart({
        sha: kind === 'foreign' ? LATER : SHA,
        recordedAtMs: 400,
        allowanceMs: 50,
        reports: [
          {
            ...report,
            steps: report.steps.map((step) => ({
              ...step,
              performance: { selfMs: 12, executionMs: 12, snapshotMs: 2 },
            })),
          },
        ],
      })
    );
  }
}

export const provideExplorer = scenarioAction({
  name: 'provideExplorer',
  act: async (s, kind: string) => {
    await seedExplorer(s, kind);
    if (kind === 'recovered') {
      await mountExplorer(s, null);
      fixture(s).available = true;
    }
  },
});

async function mountExplorer(
  s: ProductHarness,
  sha: string | null
): Promise<void> {
  const state = fixture(s);
  state.dispose?.();
  state.host?.remove();
  const host = document.createElement('div');
  document.body.appendChild(host);
  state.host = host;
  const app = createReportsApp({
    store: state.kind === 'missing' ? null : tools(s).reportStore,
    ...(state.kind === 'missing'
      ? {
          workspace: async () => {
            const inventory = await readInventory(tools(s).reportStore, SHA);
            if (inventory === null)
              throw new Error('Missing fixture inventory');
            return {
              version: { sha: SHA, branch: 'example', dirty: false },
              inventory,
              parts: [],
              readSpec: async (path: string) =>
                path === PATH ? CONTENT : null,
            };
          },
        }
      : {}),
    clock: s.harness.clock,
    timers: s.session.ports.timers,
  });
  const transport = createHonoHttpClient({ app, origin: 'http://reports' });
  const http = {
    fetch: (input: string | URL | Request, init?: RequestInit) =>
      state.available
        ? transport.fetch(input, init)
        : Promise.resolve(
            Response.json({ error: 'reports_unavailable' }, { status: 503 })
          ),
  };
  const [selected, setSelected] = createSignal(sha);
  state.dispose = render(
    () => (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={s.harness.clock} timers={s.session.ports.timers}>
          <ThemeProvider
            colorScheme="light"
            fixedLayout={{ width: 1440, height: 900 }}
          >
            <OverlayPortalProvider>
              <SurfaceStackProvider>
                <RemoteReportsApp
                  http={http}
                  timers={s.session.ports.timers}
                  apiBase="http://reports"
                  navigation={navigation()}
                  sha={selected()}
                  onOpen={setSelected}
                />
              </SurfaceStackProvider>
            </OverlayPortalProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ),
    host
  );
  s.session.onDispose(() => {
    state.dispose?.();
    host.remove();
  });
  await pollUntil(
    s,
    () =>
      Promise.resolve(
        host.querySelector(
          sha === null
            ? state.available
              ? '[data-screen="reports"] [role="menuitem"]'
              : '[data-testid="reports-retry"]'
            : '[data-testid="report-explorer"][data-state="ready"]'
        )
          ? true
          : null
      ),
    { maxMs: 2000, description: 'report explorer' }
  );
}

function activate(s: ProductHarness, selector: string): void {
  const control = fixture(s).host?.querySelector<HTMLElement>(selector);
  if (!control) throw new Error(`Explorer control missing: ${selector}`);
  control.click();
}

export const exploreSpecs = scenarioAction({
  name: 'exploreSpecs',
  act: async (s) => {
    await mountExplorer(s, SHA);
    activate(s, '[data-testid="spec-entry"]');
    await pollUntil(
      s,
      () =>
        Promise.resolve(
          explorerText(s).includes('Then Alice and Bob are friends')
            ? true
            : null
        ),
      { maxMs: 2000, description: 'readable spec' }
    );
  },
});
export const exploreParts = scenarioAction({
  name: 'exploreParts',
  act: async (s) => {
    await mountExplorer(s, SHA);
    const kind = fixture(s).kind;
    activate(
      s,
      `[data-testid="report-sections-${kind === 'quality' || kind === 'no-quality' ? 'ui-quality' : 'performance'}"]`
    );
  },
});
export const openExplorerReports = scenarioAction({
  name: 'openExplorerReports',
  act: async (s) => {
    await mountExplorer(s, null);
  },
});
export const retryExplorerReports = scenarioAction({
  name: 'retryExplorerReports',
  act: async (s) => {
    activate(s, '[data-testid="reports-retry"]');
    await pollUntil(
      s,
      () =>
        Promise.resolve(
          explorerText(s).includes('investigation') ? true : null
        ),
      { maxMs: 2000, description: 'available reports' }
    );
  },
});
export function explorerText(s: ProductHarness): string {
  return fixture(s).host?.textContent ?? '';
}
export function explorerHasReport(s: ProductHarness): boolean {
  return (
    (fixture(s).host?.querySelector(
      '[data-testid="report-spec-detail"] [role="menuitem"]'
    ) ?? null) !== null
  );
}
export function explorerOffersRetry(s: ProductHarness): boolean {
  return (
    (fixture(s).host?.querySelector('[data-testid="reports-retry"]') ??
      null) !== null
  );
}
