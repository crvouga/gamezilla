import { useCallback, useEffect, useState } from 'react';

import { CommandPalette } from './commands/palette';
import { CommandsProvider } from './commands/registry';
import { useCommandShortcuts } from './commands/shortcuts';
import { ReportViews } from './report-views';
import type { ReportNavState } from './router';
import { readWindowNav } from './router';
import { useReportData } from './use-report-data';

export function App() {
  return (
    <CommandsProvider>
      <AppShell />
    </CommandsProvider>
  );
}

function AppShell() {
  const [nav, setNav] = useState<ReportNavState>(() => readWindowNav());
  const onNav = useCallback((next: ReportNavState) => {
    setNav(next);
  }, []);
  const data = useReportData(nav, onNav);
  useCommandShortcuts();

  const bucketLabel =
    data.buckets.find((b) => b.id === nav.bucketId)?.label ??
    nav.bucketId ??
    '';

  useEffect(() => {
    const onPop = () => setNav(readWindowNav());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <>
      <ReportViews
        nav={nav}
        data={data}
        generation={data.generation}
        bucketLabel={bucketLabel}
        onNav={onNav}
      />
      <CommandPalette />
    </>
  );
}
