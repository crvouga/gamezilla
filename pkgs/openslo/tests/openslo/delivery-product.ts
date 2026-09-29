/**
 * A deterministic stand-in for a product adapter: 28 days of note saves, one
 * every ten minutes up to {@link NOW_MS}, with a known baseline (1 in 500
 * notes lost, 1 in 50 slow at 350 ms) and optional seeded faults — slower
 * delivery everywhere, or an error burst in which every delivery fails.
 */

import type { Measurement } from '@pkgs/openslo/evaluate';
import type { Measure, MeasureContext } from '@pkgs/openslo/registry';

/** Monday 2026-09-28 12:00 UTC. */
export const NOW_MS = Date.UTC(2026, 8, 28, 12);
const STEP_MS = 10 * 60_000;
const SPAN_MS = 28 * 86_400_000;

export type DeliveryFaults = {
  /** Added to every delivery time. */
  readonly slowerByMs?: number;
  /** Every note saved in `[fromMs, toMs]` is lost. */
  readonly burst?: { readonly fromMs: number; readonly toMs: number };
};

type Delivery = {
  readonly atMs: number;
  readonly delivered: boolean;
  readonly ms: number;
};

export function deliveries(faults: DeliveryFaults = {}): readonly Delivery[] {
  const out: Delivery[] = [];
  const count = SPAN_MS / STEP_MS;
  for (let i = 0; i <= count; i++) {
    const atMs = NOW_MS - SPAN_MS + i * STEP_MS;
    const inBurst =
      faults.burst !== undefined &&
      atMs >= faults.burst.fromMs &&
      atMs <= faults.burst.toMs;
    const base = i % 50 === 3 ? 350 : 40 + ((i * 37) % 120);
    out.push({
      atMs,
      delivered: i % 500 !== 7 && !inBurst,
      ms: base + (faults.slowerByMs ?? 0),
    });
  }
  return out;
}

const within = (context: MeasureContext) => (d: Delivery) =>
  d.atMs >= context.startMs && d.atMs <= context.endMs;

/** One measure per SLI of `note-delivery.openslo.yaml`. */
export function deliveryMeasures(
  faults: DeliveryFaults = {}
): Readonly<Record<string, Measure>> {
  const all = deliveries(faults);
  return {
    'note-delivered': async (context): Promise<Measurement> => ({
      kind: 'events',
      events: all
        .filter(within(context))
        .map((d) => ({ atMs: d.atMs, good: d.delivered })),
    }),
    'note-delivery-time': async (context): Promise<Measurement> => ({
      kind: 'samples',
      samples: all
        .filter(within(context))
        .filter((d) => d.delivered)
        .map((d) => ({ atMs: d.atMs, value: d.ms })),
    }),
  };
}
