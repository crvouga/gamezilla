import { Gamepad2Icon, ListChecksIcon, TabStrip } from '@pkgs/ui';
import { createEffect, createMemo, createSignal, type JSX } from 'solid-js';

import type { SimConsolePorts } from '../shared/ports';
import type { SimChromeKind } from '../shared/sim-node';
import type { ReportApiClient } from './api-client';
import { createReportApiClient } from './api-client';
import { ClientLayoutPreferenceProvider } from './debugger/client-layout-preference';
import type { PaneNavPatch, PaneNavValue } from './debugger-chrome';
import { createObjectStoreReportApiClient } from './object-store-report-api';
import { PlaygroundScreen } from './playground/playground-screen';
import { usePlaygroundSession } from './playground/use-playground-session';
import { ReportViews } from './report-views';
import type { ReportNavState } from './router';
import { NotebookStoreProvider } from './sql-notebook/notebook-store-context';
import { appShellSx } from './tokens';
import { useReportData } from './use-report-data';

export type ConsoleSection = 'reports' | 'playground';

const SECTIONS = [
  { id: 'reports', label: 'Reports', icon: ListChecksIcon },
  { id: 'playground', label: 'Playground', icon: Gamepad2Icon },
] as const;

const DEFAULT_BASE_PATH = '/sim-console';
const DEFAULT_REPORTS_PUBLIC_BASE = '/reports';

const sectionFillSx = {
  flex: 1,
  'min-height': 0,
  background: 'background',
} as const;

function sectionVisibilitySx(active: boolean) {
  return {
    ...sectionFillSx,
    display: active ? ('flex' as const) : ('none' as const),
    pointerEvents: active ? ('auto' as const) : ('none' as const),
  };
}

/**
 * Root console screen. Injects everything product-specific through `ports`
 * so `@pkgs/sim-console` never imports apps/libs/test.
 *
 * Section / playground / reports nav are controlled by the host so they can
 * sync to browser history.
 */
export function SimConsoleApp(props: {
  readonly ports: SimConsolePorts;
  readonly section: ConsoleSection;
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly reports: ReportNavState;
  readonly onSectionChange: (section: ConsoleSection) => void;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  readonly onReportsNav: (
    next: ReportNavState,
    mode?: 'push' | 'replace'
  ) => void;
}): JSX.Element {
  // Keep the playground session alive across Reports ↔ Playground; dispose only
  // when this console root unmounts (live state is lost; snapshots remain).
  const [playgroundPinned, setPlaygroundPinned] = createSignal(false);
  const [reportsVisited, setReportsVisited] = createSignal(
    props.section === 'reports'
  );

  const api = createMemo((): ReportApiClient => {
    const ports = props.ports;
    if (ports.reportsStore) {
      return createObjectStoreReportApiClient({
        store: ports.reportsStore,
        publicBaseUrl:
          ports.reportsPublicBaseUrl ?? DEFAULT_REPORTS_PUBLIC_BASE,
        fetch: (input, init) => ports.fetch(input, init),
        timers: ports.timers,
      });
    }
    return createReportApiClient({
      basePath: DEFAULT_BASE_PATH,
      fetch: (input, init) => ports.fetch(input, init),
    });
  });

  createEffect(() => {
    if (props.section === 'playground') setPlaygroundPinned(true);
    if (props.section === 'reports') setReportsVisited(true);
  });

  const session = usePlaygroundSession(
    (opts) => props.ports.bootPlayground(opts),
    playgroundPinned
  );

  return (
    <ClientLayoutPreferenceProvider>
      <NotebookStoreProvider
        {...(props.ports.notebookStore !== undefined
          ? { store: props.ports.notebookStore }
          : {})}
      >
        <div class="box" style={appShellSx}>
          <TabStrip
            aria-label="Console sections"
            items={[...SECTIONS]}
            selectedId={props.section}
            onSelect={(id) => props.onSectionChange(id as ConsoleSection)}
          />
          <div class="box flex-1 min-h-[0] bg-background">
            {reportsVisited() ? (
              <div
                class="box"
                style={sectionVisibilitySx(props.section === 'reports')}
              >
                <ReportsSection
                  api={api()}
                  nav={props.reports}
                  onNav={props.onReportsNav}
                />
              </div>
            ) : null}
            {playgroundPinned() ? (
              <div
                class="box"
                style={sectionVisibilitySx(props.section === 'playground')}
              >
                <PlaygroundScreen
                  state={session.state}
                  kind={props.kind}
                  instance={props.instance}
                  panes={props.panes}
                  onKindChange={props.onKindChange}
                  onInstanceChange={props.onInstanceChange}
                  onPanePatch={props.onPanePatch}
                  onReload={session.reboot}
                />
              </div>
            ) : null}
          </div>
        </div>
      </NotebookStoreProvider>
    </ClientLayoutPreferenceProvider>
  );
}

function ReportsSection(props: {
  readonly api: ReportApiClient;
  readonly nav: ReportNavState;
  readonly onNav: (next: ReportNavState, mode?: 'push' | 'replace') => void;
}) {
  const data = useReportData(
    () => props.nav,
    (next) => props.onNav(next, 'push'),
    () => props.api
  );
  return (
    <ReportViews
      nav={props.nav}
      data={data}
      generation={data.generation}
      onNav={props.onNav}
      api={props.api}
    />
  );
}
