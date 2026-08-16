import {
  Badge,
  Box,
  Button,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from '@pkgs/ui';
import { useState } from 'react';

import type { RunSummary, SuiteTestSummary } from '../types';
import type { BucketInfo } from './api-client';
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

const COLS = {
  run: 2,
  status: 1,
  updated: 2,
  tests: 1,
  frames: 1,
  action: 1,
} as const;

function formatUpdated(ms: number): string {
  try {
    return new Date(ms)
      .toISOString()
      .replace('T', ' ')
      .replace(/\.\d+Z$/, 'Z');
  } catch {
    return String(ms);
  }
}

export function RunsPage(props: {
  readonly nav: ReportNavState;
  readonly buckets: readonly BucketInfo[];
  readonly tests: readonly SuiteTestSummary[];
  readonly bucketId: string;
  readonly runs: readonly RunSummary[];
  readonly generation: number;
  readonly onBack: () => void;
  readonly onNav: (nav: ReportNavState) => void;
  readonly onOpenRun: (runId: string) => void;
  readonly onOpenLatest: () => void;
  readonly onDeleteRun: (runId: string) => Promise<void>;
  readonly onKeepLast: (n: number) => Promise<void>;
}) {
  const {
    nav,
    buckets,
    tests,
    bucketId,
    runs,
    generation,
    onNav,
    onOpenRun,
    onOpenLatest,
    onDeleteRun,
    onKeepLast,
  } = props;
  const [keepLast, setKeepLast] = useState(5);
  const [busy, setBusy] = useState(false);
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
        meta={`${bucketId} · ${runs.length} run${runs.length === 1 ? '' : 's'} · gen ${generation}`}
      />
      <ScrollView frameSx={appBodyFrameSx} sx={bodySx}>
        <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
          <Button title="Open latest run" size="sm" onPress={onOpenLatest} />
        </Box>
        <PruneBar
          keepLast={keepLast}
          busy={busy}
          onKeepLastChange={setKeepLast}
          onPrune={() => {
            setBusy(true);
            void onKeepLast(keepLast).finally(() => setBusy(false));
          }}
        />
        <ScrollView horizontal frameSx={{ alignSelf: 'stretch' }}>
          <RunsTable
            runs={runs}
            busy={busy}
            onOpenRun={onOpenRun}
            onDeleteRun={(runId) => {
              setBusy(true);
              void onDeleteRun(runId).finally(() => setBusy(false));
            }}
          />
        </ScrollView>
      </ScrollView>
    </Box>
  );
}

function PruneBar(props: {
  readonly keepLast: number;
  readonly busy: boolean;
  readonly onKeepLastChange: (n: number) => void;
  readonly onPrune: () => void;
}) {
  const { keepLast, busy, onKeepLastChange, onPrune } = props;
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2.5 }}>
      <Text sx={cellTextSx}>Keep last</Text>
      <TextInput
        keyboardType="number-pad"
        value={String(keepLast)}
        sx={{ width: 64 }}
        onChangeText={(text) => onKeepLastChange(Number(text) || 0)}
      />
      <Button
        title="Prune"
        size="sm"
        intent="neutral"
        variant="outline"
        disabled={busy}
        onPress={onPrune}
      />
    </Box>
  );
}

function RunsTable(props: {
  readonly runs: readonly RunSummary[];
  readonly busy: boolean;
  readonly onOpenRun: (runId: string) => void;
  readonly onDeleteRun: (runId: string) => void;
}) {
  const { runs, busy, onOpenRun, onDeleteRun } = props;
  return (
    <Box sx={{ minWidth: 640 }}>
      <Box sx={rowSx}>
        <Text sx={[thSx, { flex: COLS.run }]}>Run</Text>
        <Text sx={[thSx, { flex: COLS.status }]}>Status</Text>
        <Text sx={[thSx, { flex: COLS.updated }]}>Updated</Text>
        <Text sx={[thSx, { flex: COLS.tests }]}>Tests</Text>
        <Text sx={[thSx, { flex: COLS.frames }]}>Frames</Text>
        <Box sx={{ flex: COLS.action }} />
      </Box>
      {runs.length === 0 ? (
        <Text sx={emptySx}>No runs yet. Write reports with report:</Text>
      ) : (
        runs.map((r) => (
          <RunRow
            key={r.id}
            run={r}
            busy={busy}
            onOpen={() => onOpenRun(r.id)}
            onDelete={() => onDeleteRun(r.id)}
          />
        ))
      )}
    </Box>
  );
}

function RunRow(props: {
  readonly run: RunSummary;
  readonly busy: boolean;
  readonly onOpen: () => void;
  readonly onDelete: () => void;
}) {
  const { run: r, busy, onOpen, onDelete } = props;
  return (
    <Box sx={rowSx}>
      <Pressable sx={{ flex: COLS.run }} onPress={onOpen}>
        <Text sx={testIdSx}>{r.id}</Text>
      </Pressable>
      <Box sx={{ flex: COLS.status }}>
        <Badge
          label={r.status.toUpperCase()}
          intent={statusBadgeIntent(r.status)}
          size="sm"
        />
      </Box>
      <Text sx={[cellTextSx, { flex: COLS.updated }]}>
        {formatUpdated(r.updatedAtMs)}
      </Text>
      <Text sx={[cellTextSx, { flex: COLS.tests }]}>{r.testCount}</Text>
      <Text sx={[cellTextSx, { flex: COLS.frames }]}>{r.frameCount}</Text>
      <Box sx={{ flex: COLS.action, alignItems: 'flex-start' }}>
        <Button
          title="Delete"
          size="sm"
          intent="danger"
          variant="outline"
          disabled={busy}
          onPress={onDelete}
        />
      </Box>
    </Box>
  );
}
