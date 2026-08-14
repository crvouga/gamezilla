import { Box, Pressable, ScrollView, Text } from '@pkgs/ui';

import type { RunSummary, SuiteTestSummary } from '../types';
import { LATEST_RUN_ID } from '../types';
import type { BucketInfo } from './api-client';
import {
  breadcrumbPatchForBucket,
  breadcrumbPatchForRun,
  breadcrumbPatchForTest,
} from './nav-breadcrumb-patches';
import type { ReportNavState } from './router';
import { navigateReport } from './router';
import { t } from './tokens';

export {
  breadcrumbPatchForBucket,
  breadcrumbPatchForRun,
  breadcrumbPatchForTest,
};

type Option = { readonly value: string; readonly label: string };

export function NavBreadcrumb(props: {
  readonly nav: ReportNavState;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, buckets, runs, tests, onNav } = props;
  const showRun = nav.bucketId != null;
  const showTest = nav.runId != null;

  return (
    <ScrollView
      horizontal
      frameSx={{ flex: 1 }}
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
      accessibilityLabel="Report location"
    >
      <CrumbChips
        ariaLabel="Bucket"
        value={nav.bucketId ?? ''}
        placeholder="Bucket…"
        options={buckets.map((b) => ({ value: b.id, label: b.label }))}
        onChange={(bucketId) =>
          onNav(navigateReport(nav, breadcrumbPatchForBucket(bucketId)))
        }
      />
      {showRun ? (
        <>
          <CrumbSep />
          <CrumbChips
            ariaLabel="Run"
            value={nav.runId ?? ''}
            placeholder="Run…"
            options={[
              { value: LATEST_RUN_ID, label: 'latest' },
              ...runs.map((r) => ({ value: r.id, label: r.id })),
            ]}
            onChange={(runId) =>
              onNav(navigateReport(nav, breadcrumbPatchForRun(runId)))
            }
          />
        </>
      ) : null}
      {showTest ? (
        <>
          <CrumbSep />
          <CrumbChips
            ariaLabel="Test"
            value={nav.testId ?? ''}
            placeholder="Test…"
            options={tests.map((test) => ({
              value: test.testId,
              label: test.testId,
            }))}
            onChange={(testId) =>
              onNav(navigateReport(nav, breadcrumbPatchForTest(testId)))
            }
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function CrumbSep() {
  return (
    <Text sx={{ color: t.muted }} accessibilityElementsHidden>
      /
    </Text>
  );
}

function CrumbChips(props: {
  readonly ariaLabel: string;
  readonly value: string;
  readonly placeholder: string;
  readonly options: readonly Option[];
  readonly onChange: (value: string | null) => void;
}) {
  const { ariaLabel, value, placeholder, options, onChange } = props;
  const hasSelection = value !== '';
  return (
    <Box
      sx={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
      accessibilityLabel={ariaLabel}
    >
      {!hasSelection ? (
        <Text sx={{ color: t.muted, fontSize: 12, fontWeight: '600' }}>
          {placeholder}
        </Text>
      ) : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            sx={[chipSx, selected ? chipActiveSx : null]}
            onPress={() => onChange(selected ? null : o.value)}
          >
            <Text
              sx={{
                color: selected ? t.accent : t.text,
                fontSize: 12,
                fontWeight: '600',
              }}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </Box>
  );
}

const chipSx = {
  borderWidth: 1,
  borderColor: t.border,
  backgroundColor: t.control,
  borderRadius: t.radius,
  paddingVertical: 4,
  paddingHorizontal: 8,
} as const;

const chipActiveSx = {
  borderColor: t.accent,
  backgroundColor: t.accentSoft,
} as const;
