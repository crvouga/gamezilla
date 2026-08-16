import { Badge, Box, Pressable, ScrollView, Text } from '@pkgs/ui';

import type { RunSummary, SuiteTestSummary } from '../types';
import type { BucketInfo } from './api-client';
import { formatMs } from './frames';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import {
  appBodyFrameSx,
  appShellSx,
  cellTextSx,
  emptySx,
  rowSx,
  statusBadgeIntent,
  testIdSx,
  thSx,
  useAppBodyContentSx,
} from './tokens';

const COLS = { test: 2, status: 1, duration: 1, steps: 1, frames: 1 } as const;

export function SuitePage(props: {
  readonly nav: ReportNavState;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly bucketId: string;
  readonly runId: string;
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState) => void;
  readonly onOpenTest: (testId: string) => void;
}) {
  const { nav, buckets, runs, bucketId, runId, tests, onNav, onOpenTest } =
    props;
  const passed = tests.filter((tt) => tt.status === 'passed').length;
  const bodySx = useAppBodyContentSx();

  return (
    <Box sx={appShellSx}>
      <ReportHeader
        breadcrumb={
          <NavBreadcrumb
            nav={nav}
            buckets={buckets}
            runs={runs}
            tests={tests}
            onNav={onNav}
          />
        }
        meta={`${bucketId} · ${runId} · ${tests.length} test${tests.length === 1 ? '' : 's'}${tests.length ? ` · ${passed} passed` : ''}`}
      />
      <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
        <ScrollView horizontal frameSx={{ alignSelf: 'stretch' }}>
          <Box sx={{ minWidth: 560 }}>
            <Box sx={rowSx}>
              <Text sx={[thSx, { flex: COLS.test }]}>Test</Text>
              <Text sx={[thSx, { flex: COLS.status }]}>Status</Text>
              <Text sx={[thSx, { flex: COLS.duration }]}>Duration</Text>
              <Text sx={[thSx, { flex: COLS.steps }]}>Steps</Text>
              <Text sx={[thSx, { flex: COLS.frames }]}>Frames</Text>
            </Box>
            {tests.length === 0 ? (
              <Text sx={emptySx}>No tests in this run yet.</Text>
            ) : (
              tests.map((tt) => (
                <Pressable
                  key={tt.testId}
                  sx={rowSx}
                  onPress={() => onOpenTest(tt.testId)}
                >
                  <Text sx={[testIdSx, { flex: COLS.test }]}>{tt.testId}</Text>
                  <Box sx={{ flex: COLS.status }}>
                    <Badge
                      label={tt.status.toUpperCase()}
                      intent={statusBadgeIntent(tt.status)}
                      size="sm"
                    />
                  </Box>
                  <Text sx={[cellTextSx, { flex: COLS.duration }]}>
                    {formatMs(tt.durationMs)}
                  </Text>
                  <Text sx={[cellTextSx, { flex: COLS.steps }]}>
                    {tt.stepCount}
                  </Text>
                  <Text sx={[cellTextSx, { flex: COLS.frames }]}>
                    {tt.frameCount}
                  </Text>
                </Pressable>
              ))
            )}
          </Box>
        </ScrollView>
      </ScrollView>
    </Box>
  );
}
