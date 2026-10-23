// @io-wall-ok — explicit offline model evaluation; never downloads or changes a test run.

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createUIQualityChecker } from '@pkgs/ui-quality-check-server-ts/api';
import {
  calibrationStatistics,
  confusion,
} from '@pkgs/ui-quality-check-shared-ts/statistics';

interface Sample {
  path: string;
  split: string;
  label: string;
  family: string;
  defect: string | null;
  sha256: string;
}
const corpus = JSON.parse(await readFile('fixtures/corpus.json', 'utf8')) as {
  samples: Sample[];
};
for (const sample of corpus.samples) {
  if (
    createHash('sha256')
      .update(await readFile(sample.path))
      .digest('hex') !== sample.sha256
  )
    throw new Error(`Fixture changed: ${sample.path}`);
}
const checker = await createUIQualityChecker({
  batchSize: 32,
  provider: (process.argv[2] ?? 'auto') as 'auto',
});
try {
  const batch = await checker.checkImages(
    corpus.samples.map((sample) => sample.path)
  );
  const samples = corpus.samples.map((sample, index) => ({
    ...sample,
    score: batch.results[index]?.score ?? 0,
  }));
  const scores = (split: string, label: string) =>
    samples
      .filter((s) => s.split === split && s.label === label)
      .map((s) => s.score);
  const calibration = calibrationStatistics(
    scores('calibration', 'good'),
    scores('calibration', 'bad')
  );
  if (!calibration.recommended)
    throw new Error(
      'No useful threshold meets the false-positive budget. UIClip is unsuitable for this corpus.'
    );
  const threshold = calibration.recommended.threshold;
  const evaluation = confusion(
    scores('evaluation', 'good'),
    scores('evaluation', 'bad'),
    threshold
  );
  const paired = samples
    .filter((s) => s.label === 'bad')
    .map((bad) => {
      const good = samples.find(
        (g) =>
          g.label === 'good' && g.family === bad.family && g.split === bad.split
      );
      return {
        path: bad.path,
        preferredCorrectly: good !== undefined && good.score > bad.score,
      };
    });
  const report = {
    schemaVersion: 1,
    detectors: checker.detectors,
    knownGoodCount: samples.filter((s) => s.label === 'good').length,
    knownBadCount: samples.filter((s) => s.label === 'bad').length,
    calibration,
    evaluation,
    threshold,
    pairedRankingAccuracy:
      paired.filter((p) => p.preferredCorrectly).length / paired.length,
    perDefect: [
      ...new Set(
        samples
          .filter((s) => s.split === 'evaluation' && s.defect)
          .map((s) => s.defect)
      ),
    ].map((defect) => {
      const bad = samples.filter(
        (s) => s.split === 'evaluation' && s.defect === defect
      );
      return {
        defect,
        count: bad.length,
        detected: bad.filter((s) => s.score < threshold).length,
      };
    }),
    metrics: checker.metrics(),
    samples,
    limitations:
      'Small controlled synthetic corpus. Evaluation changes chrome/background, retaining layout families; it is not an independent real-world holdout. No claim of universal detection or CI-safe threshold for another project.',
  };
  await writeFile(
    'fixtures/evaluation.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(
    JSON.stringify(
      {
        threshold,
        evaluation,
        pairedRankingAccuracy: report.pairedRankingAccuracy,
        metrics: report.metrics,
      },
      null,
      2
    )
  );
} finally {
  await checker.dispose();
}
