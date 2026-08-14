import { Box } from '@pkgs/ui';
import { type ReactNode, useCallback, useMemo, useState } from 'react';

import type { SystemConsolePorts } from '../shared/ports';
import { createReportApiClient } from './api-client';
import { PlaygroundScreen } from './playground/playground-screen';
import { PlaygroundSessionScreen } from './playground/playground-session-screen';
import { usePlaygroundSession } from './playground/use-playground-session';
import { ReportViews } from './report-views';
import { DEFAULT_NAV, type ReportNavState } from './router';
import { TabBar } from './tab-bar';
import { appShellSx, t } from './tokens';
import { useReportData } from './use-report-data';

type Section = 'reports' | 'playground' | 'session';

const SECTIONS = [
  { id: 'reports', label: 'Reports' },
  { id: 'playground', label: 'Playground' },
  { id: 'session', label: 'Session' },
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

  const api = useMemo(
    () =>
      createReportApiClient({
        basePath: ports.reportApiBasePath ?? DEFAULT_BASE_PATH,
        fetch: (input, init) => ports.io.http.fetch(input, init),
      }),
    [ports.io, ports.reportApiBasePath]
  );

  const playgroundActive = section === 'playground' || section === 'session';
  const sessionState = usePlaygroundSession(
    ports.bootPlayground,
    playgroundActive
  );

  return (
    <Box sx={appShellSx}>
      <TabBar
        label="Console sections"
        items={[...SECTIONS]}
        selectedId={section}
        onSelect={(id) => setSection(id as Section)}
      />
      <Box sx={{ flex: 1, backgroundColor: t.bg }}>
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
