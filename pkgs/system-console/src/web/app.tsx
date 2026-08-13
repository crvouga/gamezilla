// @io-wall-ok — browser SPA composition root for wall clock/timers.
import { ClockProvider, wallClock, wallTimers } from '@pkgs/clock';
import { useCallback, useEffect, useState } from 'react';

import { ReportViews } from './report-views';
import type { ReportNavState } from './router';
import { readWindowNav } from './router';
import { useReportData } from './use-report-data';

export function App() {
  const [nav, setNav] = useState<ReportNavState>(() => readWindowNav());
  const onNav = useCallback((next: ReportNavState) => {
    setNav(next);
  }, []);
  const data = useReportData(nav, onNav);

  useEffect(() => {
    const onPop = () => setNav(readWindowNav());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  return (
    <ClockProvider clock={wallClock} timers={wallTimers}>
      <ReportViews
        nav={nav}
        data={data}
        generation={data.generation}
        onNav={onNav}
      />
    </ClockProvider>
  );
}
