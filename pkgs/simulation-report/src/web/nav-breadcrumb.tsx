import type { RunSummary, SuiteTestSummary } from '../types';
import { LATEST_RUN_ID } from '../types';
import type { BucketInfo } from './api-client';
import type { NavPatch, ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { merge, styles, t } from './theme';

/** Nav patch when the bucket select changes (clears run + test). */
export function breadcrumbPatchForBucket(bucketId: string | null): NavPatch {
  return clearPlayerNav({ bucketId, runId: null });
}

/** Nav patch when the run select changes (clears test). */
export function breadcrumbPatchForRun(runId: string | null): NavPatch {
  return clearPlayerNav({ runId });
}

/** Nav patch when the test select changes. */
export function breadcrumbPatchForTest(testId: string | null): NavPatch {
  return clearPlayerNav({ testId });
}

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
    <nav style={styles.breadcrumb} aria-label="Report location">
      <CrumbSelect
        ariaLabel="Bucket"
        value={nav.bucketId ?? ''}
        placeholder="Bucket…"
        options={buckets.map((b) => ({
          value: b.id,
          label: b.label,
        }))}
        onChange={(bucketId) => {
          onNav(
            navigateReport(
              nav,
              breadcrumbPatchForBucket(bucketId === '' ? null : bucketId)
            )
          );
        }}
      />
      {showRun ? (
        <>
          <CrumbSep />
          <CrumbSelect
            ariaLabel="Run"
            value={nav.runId ?? ''}
            placeholder="Run…"
            options={[
              { value: LATEST_RUN_ID, label: 'latest' },
              ...runs.map((r) => ({ value: r.id, label: r.id })),
            ]}
            onChange={(runId) => {
              onNav(
                navigateReport(
                  nav,
                  breadcrumbPatchForRun(runId === '' ? null : runId)
                )
              );
            }}
          />
        </>
      ) : null}
      {showTest ? (
        <>
          <CrumbSep />
          <CrumbSelect
            ariaLabel="Test"
            value={nav.testId ?? ''}
            placeholder="Test…"
            options={tests.map((test) => ({
              value: test.testId,
              label: test.testId,
            }))}
            onChange={(testId) => {
              onNav(
                navigateReport(
                  nav,
                  breadcrumbPatchForTest(testId === '' ? null : testId)
                )
              );
            }}
          />
        </>
      ) : null}
    </nav>
  );
}

function CrumbSep() {
  return (
    <span style={styles.breadcrumbSep} aria-hidden>
      /
    </span>
  );
}

function CrumbSelect(props: {
  readonly ariaLabel: string;
  readonly value: string;
  readonly placeholder: string;
  readonly options: readonly {
    readonly value: string;
    readonly label: string;
  }[];
  readonly onChange: (value: string) => void;
}) {
  const { ariaLabel, value, placeholder, options, onChange } = props;
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      style={merge(styles.breadcrumbSelect, !value && { color: t.muted })}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
