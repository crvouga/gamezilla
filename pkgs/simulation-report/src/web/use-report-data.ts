import { useCallback, useEffect, useState } from 'react';

import type {
  RunSummary,
  SimulationReportData,
  SuiteTestSummary,
} from '../types';
import {
  type BucketInfo,
  fetchBuckets,
  fetchGeneration,
  fetchManifest,
  fetchRuns,
  fetchTest,
} from './api-client';
import type { ReportNavState } from './router';
import { clearPlayerNav, navigateReport, readWindowNav } from './router';

const GENERATION_POLL_MS = 2000;

export type ReportDataApi = {
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly generation: number;
  readonly testData: SimulationReportData | null;
  readonly error: string | null;
  readonly refreshRuns: (
    bucketId: string
  ) => Promise<readonly RunSummary[] | null>;
  readonly refreshManifest: (
    bucketId: string,
    runId: string
  ) => Promise<readonly SuiteTestSummary[] | null>;
  readonly refreshTest: (
    bucketId: string,
    runId: string,
    testId: string
  ) => Promise<void>;
};

export function useReportData(nav: ReportNavState): ReportDataApi {
  const [buckets, setBuckets] = useState<readonly BucketInfo[]>([]);
  const [runs, setRuns] = useState<readonly RunSummary[]>([]);
  const [tests, setTests] = useState<readonly SuiteTestSummary[]>([]);
  const [generation, setGeneration] = useState(0);
  const [testData, setTestData] = useState<SimulationReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBuckets = useCallback(async () => {
    try {
      setBuckets(await fetchBuckets());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const refreshRuns = useCallback(async (bucketId: string) => {
    try {
      const [index, gen] = await Promise.all([
        fetchRuns(bucketId),
        fetchGeneration(bucketId),
      ]);
      setRuns(index.runs);
      setGeneration(gen);
      setError(null);
      return index.runs;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return null;
    }
  }, []);

  const refreshManifest = useCallback(
    async (bucketId: string, runId: string) => {
      try {
        const manifest = await fetchManifest(bucketId, runId);
        setTests(manifest.tests);
        setError(null);
        return manifest.tests;
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        return null;
      }
    },
    []
  );

  const refreshTest = useCallback(
    async (bucketId: string, runId: string, testId: string) => {
      try {
        setTestData(await fetchTest(bucketId, runId, testId));
        setError(null);
      } catch (err) {
        setTestData(null);
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    []
  );

  useEffect(() => {
    void refreshBuckets();
  }, [refreshBuckets]);

  useEffect(() => {
    if (!nav.bucketId) {
      setRuns([]);
      return;
    }
    void refreshRuns(nav.bucketId);
  }, [nav.bucketId, refreshRuns]);

  useEffect(() => {
    if (!nav.bucketId || !nav.runId) {
      setTests([]);
      return;
    }
    void refreshManifest(nav.bucketId, nav.runId);
  }, [nav.bucketId, nav.runId, refreshManifest]);

  useEffect(() => {
    if (!nav.bucketId || !nav.runId || !nav.testId) {
      setTestData(null);
      return;
    }
    void refreshTest(nav.bucketId, nav.runId, nav.testId);
  }, [nav.bucketId, nav.runId, nav.testId, refreshTest]);

  return {
    buckets,
    runs,
    tests,
    generation,
    testData,
    error,
    refreshRuns,
    refreshManifest,
    refreshTest,
  };
}

type PollDeps = {
  readonly refreshRuns: ReportDataApi['refreshRuns'];
  readonly refreshManifest: ReportDataApi['refreshManifest'];
  readonly refreshTest: ReportDataApi['refreshTest'];
  readonly setNav: (nav: ReportNavState) => void;
  readonly setGeneration: (gen: number) => void;
  readonly clearTestData: () => void;
};

async function applyGenerationChange(
  bucketId: string,
  deps: PollDeps
): Promise<void> {
  const list = await deps.refreshRuns(bucketId);
  const current = readWindowNav();
  if (current.bucketId !== bucketId || !current.runId) return;

  const stillThere = list?.some((r) => r.id === current.runId);
  if (!stillThere) {
    deps.setNav(navigateReport(current, clearPlayerNav({ runId: null })));
    deps.clearTestData();
    return;
  }

  const testsList = await deps.refreshManifest(bucketId, current.runId);
  if (!current.testId) return;
  const testOk = testsList?.some((t) => t.testId === current.testId);
  if (!testOk) {
    deps.setNav(navigateReport(current, clearPlayerNav()));
    deps.clearTestData();
    return;
  }
  await deps.refreshTest(bucketId, current.runId, current.testId);
}

export function useGenerationPoll(
  bucketId: string | null,
  deps: Omit<PollDeps, 'setGeneration'> & {
    readonly onGeneration: (gen: number) => void;
  }
): void {
  const {
    refreshRuns,
    refreshManifest,
    refreshTest,
    setNav,
    clearTestData,
    onGeneration,
  } = deps;

  useEffect(() => {
    if (!bucketId) return;
    let cancelled = false;
    let lastGen = -1;

    const tick = async () => {
      try {
        const gen = await fetchGeneration(bucketId);
        if (cancelled || gen === lastGen) return;
        const first = lastGen < 0;
        lastGen = gen;
        onGeneration(gen);
        if (first) return;
        await applyGenerationChange(bucketId, {
          refreshRuns,
          refreshManifest,
          refreshTest,
          setNav,
          setGeneration: onGeneration,
          clearTestData,
        });
      } catch {
        /* ignore poll errors */
      }
    };

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, GENERATION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [
    bucketId,
    refreshRuns,
    refreshManifest,
    refreshTest,
    setNav,
    clearTestData,
    onGeneration,
  ]);
}
