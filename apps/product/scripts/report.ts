import type { RunReport } from '@pkgs/harness-root-shared/report-types';
import {
  readObjectBytes,
  writeUtf8,
} from '@pkgs/object-store-root-shared/helpers';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import type { ArtifactScore, VisualGateResult } from './types';

export function failureSummary(
  score: ArtifactScore,
  threshold: number
): string {
  const origin = score.artifact.origins[0]!;
  const timestamp =
    score.artifact.kind === 'video'
      ? score.result.worstFrames[0]!.timestampMs
      : origin.timestampMs;
  return `${origin.source ?? origin.package}: ${origin.title}\n  ${origin.step}${origin.actor ? ` [${origin.actor}]` : ''} @ ${timestamp}ms; ${score.result.score.toFixed(6)} < ${threshold}\n  ${score.failureImage ?? score.result.worstFrames[0]?.artifact ?? score.artifact.file}`;
}

function reportOf(score: ArtifactScore): RunReport {
  const origin = score.artifact.origins[0]!;
  const title = `UI quality: ${origin.title} — ${origin.step}`;
  const detail = score.artifact.origins
    .map(
      (o) =>
        `${o.package}/${o.bucket}: ${o.test}${o.actor ? ` [${o.actor}]` : ''} @ ${o.timestampMs}ms (${o.step})`
    )
    .join('\n');
  return {
    meta: {
      system: 'ui-quality-check',
      runtime: 'local',
      seed: '0',
      startedAtMs: 0,
      endedAtMs: 0,
      durationMs: 0,
      status: score.result.pass ? 'passed' : 'failed',
      runId: 'latest',
      testId: score.artifact.hash,
      title,
      actorIds: [
        ...new Set(
          score.artifact.origins.flatMap((o) => (o.actor ? [o.actor] : []))
        ),
      ],
      ...(origin.source ? { sourceFile: origin.source } : {}),
      ...(!score.result.pass ? { error: score.result.summary } : {}),
    },
    steps: [
      {
        index: 1,
        kind: 'ui-quality',
        title: score.result.summary,
        status: score.result.pass ? 'passed' : 'failed',
        startedAtMs: 0,
        endedAtMs: 0,
        durationMs: 0,
        detail,
        frames: score.failureImage
          ? [
              {
                index: 1,
                capturedAtMs:
                  score.artifact.kind === 'video'
                    ? score.result.worstFrames[0]!.timestampMs
                    : origin.timestampMs,
                snapshots: [
                  {
                    name: 'UI quality failure',
                    media: 'png',
                    file: 'frames/worst.png',
                  },
                ],
              },
            ]
          : [],
        steps: [],
      },
    ],
  };
}

/** The existing reports store/API/viewer consumes these without a second report UI. */
export async function writeQualityReports(
  result: VisualGateResult,
  diagnostics: ObjectStore,
  reports: ObjectStore
): Promise<void> {
  await writeUtf8(
    reports,
    'part.json',
    JSON.stringify({
      kind: 'ui-quality',
      title: 'Recorded UI quality',
      checks: result.results.map((score) => ({
        id: score.artifact.hash,
        title: score.artifact.origins[0]!.title,
        status: score.result.pass ? 'passed' : 'failed',
        detail: score.result.summary,
        ...(score.artifact.origins[0]!.source
          ? { specPath: score.artifact.origins[0]!.source }
          : {}),
        measurements: [
          {
            name: 'Visual quality',
            value: score.result.score,
            unit: 'score',
            limit: result.threshold,
          },
        ],
      })),
    }),
    'application/json'
  );
  for (const score of result.results) {
    const prefix = `runs/latest/tests/${score.artifact.hash}/`;
    await writeUtf8(
      reports,
      `${prefix}report.json`,
      JSON.stringify(reportOf(score)),
      'application/json'
    );
    if (score.failureImage) {
      const png = await readObjectBytes(diagnostics, score.failureImage);
      if (png === null)
        throw new Error(`Missing failure image: ${score.failureImage}`);
      await reports.put(`${prefix}frames/worst.png`, png, 'image/png');
    }
  }
}

export async function writeToolingFailure(
  reports: ObjectStore,
  error: unknown
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const report: RunReport = {
    meta: {
      system: 'ui-quality-check',
      runtime: 'local',
      seed: '0',
      startedAtMs: 0,
      endedAtMs: 0,
      durationMs: 0,
      status: 'failed',
      runId: 'latest',
      testId: 'tooling',
      title: 'UI quality tooling failure',
      actorIds: [],
      error: message,
    },
    steps: [
      {
        index: 1,
        kind: 'tooling',
        title: message,
        status: 'failed',
        startedAtMs: 0,
        endedAtMs: 0,
        durationMs: 0,
        steps: [],
        frames: [],
      },
    ],
  };
  await writeUtf8(
    reports,
    'runs/latest/tests/tooling/report.json',
    JSON.stringify(report),
    'application/json'
  );
}
