import type { BatchQualityResult } from './ui-quality-check-types';
import { timestamp } from './result';

export function textReport(batch: BatchQualityResult): string {
  const rows = ['UI Quality Check', ''];
  for (const result of batch.results)
    rows.push(
      `${result.pass ? '✓' : '✗'} ${result.input}  ${result.score.toFixed(3)}`
    );
  rows.push('', batch.summary);
  if (batch.results.some((r) => r.thresholdSource === 'experimental'))
    rows.push(
      'Threshold 0.5 is an uncalibrated neutral prompt boundary. Calibrate before gating CI.'
    );
  for (const result of batch.results.filter((r) => !r.pass)) {
    rows.push(
      '',
      `Required: >= ${result.threshold}; worst: ${result.worstScore.toFixed(3)}; analyzed: ${result.framesAnalyzed}; duration: ${(result.durationMs / 1000).toFixed(2)}s`
    );
    for (const frame of result.worstFrames)
      rows.push(
        `${timestamp(frame.timestampMs)}  ${frame.quality.toFixed(3)}${frame.artifact ? `  ${frame.artifact}` : ''}${frame.clip ? `  ${frame.clip}` : ''}`
      );
  }
  if (batch.results[0])
    rows.push(
      '',
      `Execution: ${batch.results[0].detectors.map((d) => `${d.id} (${d.executionProvider}, ${d.version})`).join(', ')}`
    );
  return rows.join('\n');
}
