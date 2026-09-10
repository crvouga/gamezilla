import { FlaskConicalIcon, MonitorPlayIcon, TabStrip } from '@pkgs/ui';
import { createEffect, createMemo, createSignal, type JSX } from 'solid-js';

import type { SimConsolePorts } from '../shared/ports';
import type { SimChromeKind } from '../shared/sim-node';
import type { ReportApiClient } from './api-client';
import { createReportApiClient } from './api-client';
import { ClientLayoutPreferenceProvider } from './debugger/client-layout-preference';
import type { PaneNavPatch, PaneNavValue } from './debugger-chrome';
import { createObjectStoreReportApiClient } from './object-store-report-api';
import { ProductSimulatorScreen } from './product-simulator/product-simulator-screen';
import { useProductSimulatorSession } from './product-simulator/use-product-simulator-session';
import { ReportViews } from './report-views';
import type { ReportNavState } from './router';
import { NotebookStoreProvider } from './sql-notebook/notebook-store-context';
import { appShellSx } from './tokens';
import { useReportData } from './use-report-data';

export type ConsoleSection = 'tests' | 'simulator';

const SECTIONS = [
  { id: 'tests', label: 'Tests', icon: FlaskConicalIcon },
  { id: 'simulator', label: 'Simulator', icon: MonitorPlayIcon },
] as const;

const DEFAULT_BASE_PATH = '/sim-console';
const DEFAULT_PRODUCT_TESTS_PUBLIC_BASE = '/product-tests';

const sectionFillClass = 'box flex-1 min-h-[0] bg-background';

function sectionVisibilityStyle(active: boolean): JSX.CSSProperties {
  return {
    display: active ? 'flex' : 'none',
    'pointer-events': active ? 'auto' : 'none',
  };
}

/**
 * Root console screen. Injects everything product-specific through `ports`
 * so `@pkgs/sim-console` never imports apps/libs/test.
 *
 * Section / simulator / tests nav are controlled by the host so they can
 * sync to browser history.
 */
export function SimConsoleApp(props: {
  readonly ports: SimConsolePorts;
  readonly section: ConsoleSection;
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly panes: Readonly<Record<string, PaneNavValue>>;
  readonly tests: ReportNavState;
  readonly onSectionChange: (section: ConsoleSection) => void;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onPanePatch: (
    id: string,
    patch: PaneNavPatch,
    mode?: 'push' | 'replace'
  ) => void;
  readonly onTestsNav: (
    next: ReportNavState,
    mode?: 'push' | 'replace'
  ) => void;
}): JSX.Element {
  // Keep the simulator session alive across Tests ↔ Simulator; dispose only
  // when this console root unmounts (live state is lost; snapshots remain).
  const [simulatorPinned, setSimulatorPinned] = createSignal(false);
  const [testsVisited, setTestsVisited] = createSignal(
    props.section === 'tests'
  );

  const api = createMemo((): ReportApiClient => {
    const ports = props.ports;
    if (ports.productTestsStore) {
      return createObjectStoreReportApiClient({
        store: ports.productTestsStore,
        publicBaseUrl:
          ports.productTestsPublicBaseUrl ?? DEFAULT_PRODUCT_TESTS_PUBLIC_BASE,
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
    if (props.section === 'simulator') setSimulatorPinned(true);
    if (props.section === 'tests') setTestsVisited(true);
  });

  const session = useProductSimulatorSession(
    (opts) => props.ports.bootProductSimulator(opts),
    simulatorPinned
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
            {testsVisited() ? (
              <div
                class={sectionFillClass}
                style={sectionVisibilityStyle(props.section === 'tests')}
              >
                <TestsSection
                  api={api()}
                  nav={props.tests}
                  onNav={props.onTestsNav}
                />
              </div>
            ) : null}
            {simulatorPinned() ? (
              <div
                class={sectionFillClass}
                style={sectionVisibilityStyle(props.section === 'simulator')}
              >
                <ProductSimulatorScreen
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

function TestsSection(props: {
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
