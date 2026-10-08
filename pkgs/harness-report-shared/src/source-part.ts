import type { ReportPart } from './explorer-types';
import { viewerTestId } from './keys';
import type { SourceRecord } from './protocol';

export function sourcePart(sha: string, source: SourceRecord): ReportPart {
  const kind = source.bucket === 'ui-quality' ? 'ui-quality' : 'behavior';
  const primary = source.evidence?.find((part) => part.kind !== 'performance');
  if (primary)
    return withProducerFailure(
      {
        ...primary,
        sha,
        id: source.source,
        recordedAtMs: source.updatedAtMs,
        checks: primary.checks.map((check) => ({
          ...check,
          id: viewerTestId(source.source, check.id),
        })),
      },
      source
    );
  return withProducerFailure(
    {
      sha,
      id: source.source,
      kind,
      title: `${source.packageDir} / ${source.bucket}`,
      recordedAtMs: source.updatedAtMs,
      checks: source.tests.map((test) => ({
        id: viewerTestId(source.source, test.testId),
        title: test.title,
        status: test.status === 'skipped' ? 'not-run' : test.status,
        detail: test.error ?? '',
        ...(test.sourceFile === undefined ? {} : { specPath: test.sourceFile }),
        measurements: [],
      })),
    },
    source
  );
}

function withProducerFailure(
  part: ReportPart,
  source: SourceRecord
): ReportPart {
  if (
    source.status !== 'failed' ||
    part.checks.some((check) => check.status === 'failed')
  )
    return part;
  return {
    ...part,
    checks: [
      ...part.checks,
      {
        id: `${source.source}:producer-failure`,
        title: 'Producer failed',
        status: 'failed',
        detail:
          'The report producer did not complete successfully. Individual recorded outcomes are preserved.',
        measurements: [],
      },
    ],
  };
}

export function sourceParts(
  sha: string,
  source: SourceRecord
): readonly ReportPart[] {
  return [
    sourcePart(sha, source),
    ...(source.evidence ?? [])
      .filter((part) => part.kind === 'performance')
      .map((part) => ({
        ...part,
        sha,
        id: `${source.source}--${part.kind}`,
        recordedAtMs: source.updatedAtMs,
        checks: part.checks.map((check) => ({
          ...check,
          id: viewerTestId(source.source, check.id),
        })),
      })),
  ];
}
