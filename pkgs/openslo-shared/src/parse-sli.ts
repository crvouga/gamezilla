/**
 * An SLI's `spec`: a `ratioMetric` (good or bad events over total) or a
 * `thresholdMetric` (one value per sample). Metric sources are product words:
 * they need a `type` and a non-empty `spec`, and are otherwise opaque.
 */

import type { MetricSource, RatioMetric, Sli, ThresholdMetric } from './model';
import type { Cursor, Mapping } from './parse-fields';
import { isMapping, readBoolean, readMapping, readMetadata, readOptionalString, readString, report } from './parse-fields';

/** A whole SLI (`metadata` + `spec`), declared or inline. */
export function readSli(
  at: Cursor,
  input: { readonly from: Mapping; readonly inline: boolean }
): Sli | null {
  const metadata = readMetadata(at, input.from);
  if (metadata === null) return null;
  const here: Cursor = {
    where: `${input.inline ? 'inline SLI' : 'SLI'} ${metadata.name}`,
    issues: at.issues,
  };
  const spec = readMapping(here, input.from, 'spec');
  if (spec === null) return null;
  const description = readOptionalString(here, spec, 'description');
  const metric = readMetric(here, spec);
  if (metric === null) return null;
  return {
    name: metadata.name,
    displayName: metadata.displayName,
    description,
    inline: input.inline,
    metric,
  };
}

function readMetric(
  at: Cursor,
  spec: Mapping
): RatioMetric | ThresholdMetric | null {
  const hasRatio = spec['ratioMetric'] !== undefined;
  const hasThreshold = spec['thresholdMetric'] !== undefined;
  if (hasRatio === hasThreshold) {
    return report(
      at,
      'spec needs exactly one of ratioMetric and thresholdMetric'
    );
  }
  if (hasThreshold) {
    const threshold = readMapping(at, spec, 'thresholdMetric');
    if (threshold === null) return null;
    const source = readSourceHolder(at, threshold, 'thresholdMetric');
    return source === null ? null : { kind: 'threshold', source };
  }
  return readRatio(at, spec);
}

function readRatio(at: Cursor, spec: Mapping): RatioMetric | null {
  const ratio = readMapping(at, spec, 'ratioMetric');
  if (ratio === null) return null;
  const counter = readBoolean(at, ratio, 'counter');
  const hasGood = ratio['good'] !== undefined;
  const hasBad = ratio['bad'] !== undefined;
  if (hasGood === hasBad) {
    report(at, 'ratioMetric needs exactly one of good and bad');
  }
  const good = hasGood ? readHeldSource(at, ratio, 'good') : null;
  const bad = hasBad ? readHeldSource(at, ratio, 'bad') : null;
  const total = readHeldSource(at, ratio, 'total');
  if (
    counter === null ||
    total === null ||
    hasGood === hasBad ||
    (good ?? bad) === null
  ) {
    return null;
  }
  return { kind: 'ratio', counter, good, bad, total };
}

/** `ratioMetric.<field>: { metricSource: … }`. */
function readHeldSource(
  at: Cursor,
  ratio: Mapping,
  field: string
): MetricSource | null {
  const holder = readMapping(at, ratio, field);
  if (holder === null) return null;
  return readSourceHolder(at, holder, `ratioMetric.${field}`);
}

function readSourceHolder(
  at: Cursor,
  holder: Mapping,
  path: string
): MetricSource | null {
  const source = holder['metricSource'];
  if (!isMapping(source)) {
    return report(at, `${path}.metricSource must be a mapping`);
  }
  const here: Cursor = {
    where: `${at.where} ${path}.metricSource`,
    issues: at.issues,
  };
  const type = readString(here, source, 'type');
  const spec = source['spec'];
  if (!isMapping(spec) || Object.keys(spec).length === 0) {
    return report(here, 'spec must be a non-empty mapping');
  }
  return type === null ? null : { type, spec };
}
