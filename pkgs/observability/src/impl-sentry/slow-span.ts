import {
  isSlowSpan,
  SlowSpanSemconv,
  slowThresholdMsForSpan,
} from '../shared/slow-thresholds';

export function applySlowSpanAttributes(args: {
  spanName: string;
  durationMs: number;
  setAttribute: (key: string, value: string | number | boolean) => void;
}): void {
  const thresholdMs = slowThresholdMsForSpan(args.spanName);
  args.setAttribute(SlowSpanSemconv.durationMs, Math.round(args.durationMs));
  args.setAttribute(SlowSpanSemconv.thresholdMs, thresholdMs);
  if (isSlowSpan(args.spanName, args.durationMs)) {
    args.setAttribute(SlowSpanSemconv.slow, true);
  }
}
