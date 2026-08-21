import { useEffect, useRef, useState } from 'react';

import type {
  RunSummary,
  SimulationReportData,
  SuiteTestSummary,
} from '../types';
import { isLatestRunId } from '../types';
import type { BucketInfo, ReportApiClient } from './api-client';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';

export type ReportDataApi = {
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly generation: number;
  /** Concrete run id when following `latest`, else nav.runId. */
  readonly resolvedRunId: string | null;
  readonly testData: SimulationReportData | null;
  readonly error: string | null;
};

type NavRef = { current: ReportNavState };
type SetNav = (nav: ReportNavState) => void;

/**
 * Reactive report data over SSE. Opens `/api/events` for buckets and
 * `/api/buckets/:id/events` for runs/manifest/test keyed off bucket/run/test
 * identity — not frame/view/node scrub.
 */
export function useReportData(
  nav: ReportNavState,
  setNav: SetNav,
  api: ReportApiClient
): ReportDataApi {
  const [buckets, setBuckets] = useState<readonly BucketInfo[]>([]);
  const [runs, setRuns] = useState<readonly RunSummary[]>([]);
  const [tests, setTests] = useState<readonly SuiteTestSummary[]>([]);
  const [generation, setGeneration] = useState(0);
  const [resolvedRunId, setResolvedRunId] = useState<string | null>(null);
  const [testData, setTestData] = useState<SimulationReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    const handle = api.openBucketsEvents({
      onBuckets: (list) => {
        setBuckets(list);
        setError(null);
      },
      onError: () => setError('buckets stream error'),
    });
    return () => handle.close();
  }, [api]);

  useBucketEvents({
    api,
    bucketId: nav.bucketId,
    runId: nav.runId,
    testId: nav.testId,
    navRef,
    setNav,
    setRuns,
    setGeneration,
    setTests,
    setTestData,
    setResolvedRunId,
    setError,
  });

  return {
    buckets,
    runs,
    tests,
    generation,
    resolvedRunId:
      resolvedRunId ??
      (nav.runId && !isLatestRunId(nav.runId) ? nav.runId : null),
    testData,
    error,
  };
}

function useBucketEvents(args: {
  readonly api: ReportApiClient;
  readonly bucketId: string | null;
  readonly runId: string | null;
  readonly testId: string | null;
  readonly navRef: NavRef;
  readonly setNav: SetNav;
  readonly setRuns: (runs: readonly RunSummary[]) => void;
  readonly setGeneration: (n: number) => void;
  readonly setTests: (tests: readonly SuiteTestSummary[]) => void;
  readonly setTestData: (data: SimulationReportData | null) => void;
  readonly setResolvedRunId: (id: string | null) => void;
  readonly setError: (error: string | null) => void;
}): void {
  const {
    api,
    bucketId,
    runId,
    testId,
    navRef,
    setNav,
    setRuns,
    setGeneration,
    setTests,
    setTestData,
    setResolvedRunId,
    setError,
  } = args;

  useEffect(() => {
    if (!bucketId) {
      setRuns([]);
      setGeneration(0);
      setTests([]);
      setTestData(null);
      setResolvedRunId(null);
      return;
    }

    const handle = api.openBucketEvents({
      bucketId,
      runId,
      testId,
      handlers: bucketEventHandlers({
        bucketId,
        navRef,
        setNav,
        setRuns,
        setGeneration,
        setTests,
        setTestData,
        setResolvedRunId,
        setError,
      }),
    });

    return () => handle.close();
  }, [
    api,
    bucketId,
    runId,
    testId,
    navRef,
    setNav,
    setRuns,
    setGeneration,
    setTests,
    setTestData,
    setResolvedRunId,
    setError,
  ]);
}

function bucketEventHandlers(args: {
  readonly bucketId: string;
  readonly navRef: NavRef;
  readonly setNav: SetNav;
  readonly setRuns: (runs: readonly RunSummary[]) => void;
  readonly setGeneration: (n: number) => void;
  readonly setTests: (tests: readonly SuiteTestSummary[]) => void;
  readonly setTestData: (data: SimulationReportData | null) => void;
  readonly setResolvedRunId: (id: string | null) => void;
  readonly setError: (error: string | null) => void;
}) {
  return {
    onRuns: (ev: { runs: readonly RunSummary[]; generation: number }) => {
      args.setRuns(ev.runs);
      args.setGeneration(ev.generation);
      args.setError(null);
      applyRunsNavGuards({
        current: args.navRef.current,
        bucketId: args.bucketId,
        runs: ev.runs,
        setNav: args.setNav,
        clearTest: () => args.setTestData(null),
      });
    },
    onManifest: (ev: {
      resolvedRunId: string | null;
      tests: readonly SuiteTestSummary[];
      missing: boolean;
    }) => {
      args.setResolvedRunId(ev.resolvedRunId);
      args.setTests(ev.tests);
      const current = args.navRef.current;
      if (ev.missing && current.runId && !isLatestRunId(current.runId)) {
        args.setNav(navigateReport(current, clearPlayerNav({ runId: null })));
        args.setTestData(null);
      }
    },
    onTest: (ev: {
      resolvedRunId: string | null;
      data: SimulationReportData | null;
      missing: boolean;
    }) => {
      if (ev.resolvedRunId != null) args.setResolvedRunId(ev.resolvedRunId);
      const current = args.navRef.current;
      if (ev.missing || !ev.data) {
        args.setTestData(null);
        if (current.testId && !ev.missing) return;
        if (current.testId && ev.missing) {
          args.setNav(navigateReport(current, clearPlayerNav()));
        }
        return;
      }
      args.setTestData(ev.data);
      args.setError(null);
    },
    onError: () => args.setError('bucket stream error'),
  };
}

function applyRunsNavGuards(args: {
  readonly current: ReportNavState;
  readonly bucketId: string;
  readonly runs: readonly RunSummary[];
  readonly setNav: SetNav;
  readonly clearTest: () => void;
}): void {
  const { current } = args;
  if (current.bucketId !== args.bucketId || !current.runId) return;
  if (isLatestRunId(current.runId)) return;
  const stillThere = args.runs.some((r) => r.id === current.runId);
  if (!stillThere) {
    args.setNav(navigateReport(current, clearPlayerNav({ runId: null })));
    args.clearTest();
  }
}
