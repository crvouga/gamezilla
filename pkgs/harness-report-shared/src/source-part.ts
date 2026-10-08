import type { ReportPart } from './explorer-types';
import { viewerTestId } from './keys';
import type { SourceRecord } from './protocol';

export function sourcePart(sha: string, source: SourceRecord): ReportPart {
  const kind = source.bucket === 'ui-quality' ? 'ui-quality' : 'behavior';
  const primary = source.evidence?.find((part) => part.kind !== 'performance');
  if (primary)
    return {
      ...primary,
      sha,
      id: source.source,
      recordedAtMs: source.updatedAtMs,
      checks: primary.checks.map((check) => ({
        ...check,
        id: viewerTestId(source.source, check.id),
      })),
    };
  return {
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
