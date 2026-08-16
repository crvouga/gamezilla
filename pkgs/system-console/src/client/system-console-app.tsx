import {
  Box,
  Gamepad2Icon,
  HistoryIcon,
  ListChecksIcon,
  TabStrip,
} from '@pkgs/ui';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { SystemConsolePorts } from '../shared/ports';
import { createReportApiClient } from './api-client';
import { PlaygroundScreen } from './playground/playground-screen';
import { PlaygroundSessionScreen } from './playground/playground-session-screen';
import { usePlaygroundSession } from './playground/use-playground-session';
import { ReportViews } from './report-views';
import { DEFAULT_NAV, type ReportNavState } from './router';
import { appShellSx } from './tokens';
import { useReportData } from './use-report-data';

type Section = 'reports' | 'playground' | 'session';

const SECTIONS = [
  { id: 'reports', label: 'Reports', icon: ListChecksIcon },
  { id: 'playground', label: 'Playground', icon: Gamepad2Icon },
  { id: 'session', label: 'Session', icon: HistoryIcon },
] as const;

const DEFAULT_BASE_PATH = '/system-console';

/**
 * Root console screen. Injects everything product-specific through `ports`
 * so `@pkgs/system-console` never imports apps/libs/test.
 */
export function SystemConsoleApp<R>(props: {
  readonly ports: SystemConsolePorts<R>;
}): ReactNode {
  const { ports } = props;
  const [section, setSection] = useState<Section>('reports');
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

  const playgroundSection = section === 'playground' || section === 'session';
  useEffect(() => {
    if (playgroundSection) setPlaygroundPinned(true);
  }, [playgroundSection]);

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
        onSelect={(id) => setSection(id as Section)}
      />
      <Box sx={{ flex: 1, minHeight: 0, background: 'background' }}>
        {section === 'reports' ? <ReportsSection api={api} /> : null}
        {section === 'playground' ? (
          <PlaygroundScreen ports={ports} state={sessionState} />
        ) : null}
        {section === 'session' ? (
          <PlaygroundSessionScreen state={sessionState} />
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
