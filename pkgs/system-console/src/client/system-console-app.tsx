import { Box, Gamepad2Icon, ListChecksIcon, TabStrip } from '@pkgs/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { SystemConsolePorts } from '../shared/ports';
import { createReportApiClient } from './api-client';
import {
  type PlaygroundKindId,
  PlaygroundScreen,
} from './playground/playground-screen';
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

const DEFAULT_BASE_PATH = '/system-console';

/**
 * Root console screen. Injects everything product-specific through `ports`
 * so `@pkgs/system-console` never imports apps/libs/test.
 *
 * Section / playground kind / panel view are controlled by the host so they
 * can sync to browser history.
 */
export function SystemConsoleApp<R>(props: {
  readonly ports: SystemConsolePorts<R>;
  readonly section: ConsoleSection;
  readonly kind: PlaygroundKindId;
  readonly view: string;
  readonly clientViews: Readonly<Record<string, string>>;
  readonly onSectionChange: (section: ConsoleSection) => void;
  readonly onKindChange: (kind: PlaygroundKindId) => void;
  readonly onViewChange: (view: string) => void;
  readonly onClientViewChange: (clientId: string, view: string) => void;
}): ReactNode {
  const {
    ports,
    section,
    kind,
    view,
    clientViews,
    onSectionChange,
    onKindChange,
    onViewChange,
    onClientViewChange,
  } = props;
  // Keep the in-memory World alive across Reports ↔ Playground; dispose only
  // when this console root unmounts (live state is lost; snapshots remain).
  const [playgroundPinned, setPlaygroundPinned] = useState(false);

  const api = useMemo(
    () =>
      createReportApiClient({
        basePath: ports.reportApiBasePath ?? DEFAULT_BASE_PATH,
        fetch: (input, init) => ports.io.http.fetch(input, init),
      }),
    [ports.io, ports.reportApiBasePath]
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
        {section === 'reports' ? <ReportsSection api={api} /> : null}
        {section === 'playground' ? (
          <PlaygroundScreen
            ports={ports}
            state={sessionState}
            kind={kind}
            view={view}
            clientViews={clientViews}
            onKindChange={onKindChange}
            onViewChange={onViewChange}
            onClientViewChange={onClientViewChange}
          />
        ) : null}
      </Box>
    </Box>
  );
}

function ReportsSection(props: {
  readonly api: ReturnType<typeof createReportApiClient>;
}) {
  const { api } = props;
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
    />
  );
}
