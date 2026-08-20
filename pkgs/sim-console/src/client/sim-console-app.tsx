import { Box, Gamepad2Icon, ListChecksIcon, TabStrip } from '@pkgs/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { SimConsolePorts } from '../shared/ports';
import type { SimChromeKind } from '../shared/sim-node';
import { createReportApiClient } from './api-client';
import { PlaygroundScreen } from './playground/playground-screen';
import { usePlaygroundSession } from './playground/use-playground-session';
import { ReportViews } from './report-views';
import { DEFAULT_NAV, type ReportNavState } from './router';
import { appShellSx } from './tokens';
import { useReportData } from './use-report-data';

export type ConsoleSection = 'reports' | 'playground';

const SECTIONS = [
  { id: 'reports', label: 'Reports', icon: ListChecksIcon },
  { id: 'playground', label: 'Playground', icon: Gamepad2Icon },
] as const;

const DEFAULT_BASE_PATH = '/sim-console';

/**
 * Root console screen. Injects everything product-specific through `ports`
 * so `@pkgs/sim-console` never imports apps/libs/test.
 *
 * Section / playground kind / panel view are controlled by the host so they
 * can sync to browser history.
 */
export function SimConsoleApp(props: {
  readonly ports: SimConsolePorts;
  readonly section: ConsoleSection;
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly view: string;
  readonly onSectionChange: (section: ConsoleSection) => void;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onViewChange: (view: string) => void;
}): ReactNode {
  const {
    ports,
    section,
    kind,
    instance,
    view,
    onSectionChange,
    onKindChange,
    onInstanceChange,
    onViewChange,
  } = props;
  // Keep the playground session alive across Reports ↔ Playground; dispose only
  // when this console root unmounts (live state is lost; snapshots remain).
  const [playgroundPinned, setPlaygroundPinned] = useState(false);

  const api = useMemo(
    () =>
      createReportApiClient({
        basePath: ports.reportApiBasePath ?? DEFAULT_BASE_PATH,
        fetch: (input, init) => ports.fetch(input, init),
      }),
    [ports.fetch, ports.reportApiBasePath]
  );

  useEffect(() => {
    if (section === 'playground') setPlaygroundPinned(true);
  }, [section]);

  const { state: sessionState } = usePlaygroundSession(
    ports.bootPlayground,
    playgroundPinned
  );

  return (
    <Box sx={appShellSx}>
      <TabStrip
        accessibilityLabel="Console sections"
        items={[...SECTIONS]}
        selectedId={section}
        onSelect={(id) => onSectionChange(id as ConsoleSection)}
      />
      <Box sx={{ flex: 1, minHeight: 0, background: 'background' }}>
        {section === 'reports' ? (
          <ReportsSection
            api={api}
            ports={ports}
            kind={kind}
            instance={instance}
            view={view}
            onKindChange={onKindChange}
            onInstanceChange={onInstanceChange}
            onViewChange={onViewChange}
          />
        ) : null}
        {section === 'playground' ? (
          <PlaygroundScreen
            state={sessionState}
            kind={kind}
            instance={instance}
            view={view}
            onKindChange={onKindChange}
            onInstanceChange={onInstanceChange}
            onViewChange={onViewChange}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function ReportsSection(props: {
  readonly api: ReturnType<typeof createReportApiClient>;
  readonly ports: SimConsolePorts;
  readonly kind: SimChromeKind;
  readonly instance: string;
  readonly view: string;
  readonly onKindChange: (kind: SimChromeKind) => void;
  readonly onInstanceChange: (instance: string) => void;
  readonly onViewChange: (view: string) => void;
}) {
  const { api, ports } = props;
  const [nav, setNav] = useState<ReportNavState>(DEFAULT_NAV);
  const onNav = useCallback((next: ReportNavState) => setNav(next), []);
  const data = useReportData(nav, onNav, api);
  return (
    <ReportViews
      nav={nav}
      data={data}
      generation={data.generation}
      onNav={onNav}
      api={api}
      chrome={{
        kind: props.kind,
        instance: props.instance,
        view: props.view,
        onKindChange: props.onKindChange,
        onInstanceChange: props.onInstanceChange,
        onViewChange: props.onViewChange,
      }}
      ports={ports}
    />
  );
}
