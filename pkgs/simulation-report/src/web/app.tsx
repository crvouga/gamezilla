import { useCallback, useEffect, useState } from 'react';
import { ReportViews } from './report-views';
import type { ReportNavState } from './router';
import { readWindowNav } from './router';
import { useGenerationPoll, useReportData } from './use-report-data';

export function App() {
  const [nav, setNav] = useState<ReportNavState>(() => readWindowNav());
  const data = useReportData(nav);
  const [generation, setGeneration] = useState(0);

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
    <ReportViews
      nav={nav}
      data={data}
      generation={generation || data.generation}
      bucketLabel={bucketLabel}
      onNav={onNav}
    />
  );
}
