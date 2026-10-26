import type { MetricContract } from './metric-contract';

/**
 * The names an OTLP metric takes in a Prometheus-compatible backend (Mimir
 * through its OTLP endpoint, default "underscore escaping with suffixes"
 * translation), written once so a query never spells a name by hand:
 *
 * - every character outside `[a-zA-Z0-9_:]` becomes `_` (repeats collapse);
 * - a unit adds a suffix (`s` → `_seconds`); `{annotation}` units add none;
 * - a counter adds `_total`;
 * - a histogram becomes `_bucket`, `_sum` and `_count` series;
 * - a gauge keeps its family name;
 * - an attribute name is escaped the same way (`app.http.route_group` →
 *   `app_http_route_group`).
 */

const UNIT_SUFFIXES: Readonly<Record<string, string>> = {
  s: 'seconds',
  ms: 'milliseconds',
  us: 'microseconds',
  ns: 'nanoseconds',
  min: 'minutes',
  h: 'hours',
  d: 'days',
  By: 'bytes',
  KiBy: 'kibibytes',
  MiBy: 'mebibytes',
  '%': 'percent',
};

export function escapePrometheusName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_:]/g, '_').replace(/_{2,}/g, '_');
}

/** The suffix a unit adds to a metric family, or `null` when it adds none. */
function unitSuffix(unit: string): string | null {
  const withoutAnnotations = unit.replace(/\{[^}]*\}/g, '').trim();
  if (withoutAnnotations === '' || withoutAnnotations === '1') return null;
  const parts = withoutAnnotations.split('/');
  const words = parts.map((part) => UNIT_SUFFIXES[part] ?? part);
  const joined = words.length === 2 ? words.join('_per_') : words.join('_');
  return escapePrometheusName(joined);
}

export type PrometheusSeries =
  | { readonly kind: 'counter'; readonly total: string }
  | { readonly kind: 'gauge'; readonly value: string }
  | {
      readonly kind: 'histogram';
      readonly bucket: string;
      readonly sum: string;
      readonly count: string;
    };

export function prometheusFamily(
  contract: Pick<MetricContract, 'name' | 'unit' | 'type'>
): string {
  const base = escapePrometheusName(contract.name);
  const suffix = unitSuffix(contract.unit);
  return suffix === null || base.endsWith(`_${suffix}`)
    ? base
    : `${base}_${suffix}`;
}

/** The series names a backend stores for one OTLP instrument. */
export function prometheusSeries(
  contract: Pick<MetricContract, 'name' | 'unit' | 'type'>
): PrometheusSeries {
  const family = prometheusFamily(contract);
  if (contract.type === 'counter') {
    return {
      kind: 'counter',
      total: family.endsWith('_total') ? family : `${family}_total`,
    };
  }
  if (contract.type === 'gauge') return { kind: 'gauge', value: family };
  return {
    kind: 'histogram',
    bucket: `${family}_bucket`,
    sum: `${family}_sum`,
    count: `${family}_count`,
  };
}
