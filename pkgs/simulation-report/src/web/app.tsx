import { useCallback, useEffect, useState } from 'react';

import { CommandPalette } from './commands/palette';
import { CommandsProvider } from './commands/registry';
import { useCommandShortcuts } from './commands/shortcuts';
import { ReportViews } from './report-views';
import type { ReportNavState } from './router';
import { readWindowNav } from './router';
import { useGenerationPoll, useReportData } from './use-report-data';

export function App() {
  return (
    <CommandsProvider>
      <AppShell />
    </CommandsProvider>
  );
}

function AppShell() {
  const [nav, setNav] = useState<ReportNavState>(() => readWindowNav());
  const data = useReportData(nav);
  const [generation, setGeneration] = useState(0);
  useCommandShortcuts();

  const bucketLabel =
    data.buckets.find((b) => b.id === nav.bucketId)?.label ??
    nav.bucketId ??
    '';

  const onNav = useCallback((next: ReportNavState) => {
    setNav(next);
  }, []);

  useEffect(() => {
    const onPop = () => setNav(readWindowNav());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useGenerationPoll(nav.bucketId, {
    refreshRuns: data.refreshRuns,
    refreshManifest: data.refreshManifest,
    refreshTest: data.refreshTest,
    setNav: onNav,
    clearTestData: () => undefined,
    onGeneration: setGeneration,
  });

  return (
    <>
      <ReportViews
        nav={nav}
        data={data}
        generation={generation || data.generation}
        bucketLabel={bucketLabel}
        onNav={onNav}
      />
      <CommandPalette />
    </>
  );
}
