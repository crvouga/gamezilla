/**
 * Check a parsed objective file against a binding: whether the binding
 * measures exactly the indicators the file's SLOs use, and — per SLO —
 * measure its indicator once and evaluate every objective. This is what the
 * bun-test bridge runs; a product's own mutation tests can run it with a
 * degraded measure and require an objective to fail.
 */

import type { Evaluation, Measurement } from './evaluate';
import { evaluateObjective } from './evaluate';
import type { OpenSloDoc, Slo } from './model';
import { parseOpenSlo } from './parse';
import type { MeasureContext, ObjectivesBinding } from './registry';
import { windowBounds } from './window';

export type ObjectiveResult = {
  /** The evidence obligation: `objective:<slo>:<displayName>`. */
  readonly id: string;
  readonly slo: string;
  readonly objective: string;
  readonly evaluation: Evaluation;
};

export function objectiveId(slo: string, displayName: string): string {
  return `objective:${slo}:${displayName}`;
}

/** SLIs the SLOs use without a measure, and measures naming no SLI. */
export function bindingIssues(
  doc: OpenSloDoc,
  binding: ObjectivesBinding
): readonly string[] {
  const issues: string[] = [];
  const file = `tests/openslo/${binding.spec}.binding.ts`;
  const used = [...new Set(doc.slos.map((slo) => slo.indicator))];
  for (const sli of used) {
    if (binding.measure[sli] === undefined) {
      issues.push(
        `SLI ${sli} has no measure — add measure['${sli}'] to ${file}`
      );
    }
  }
  const declared = new Set(doc.slis.map((sli) => sli.name));
  for (const name of Object.keys(binding.measure).sort()) {
    if (!declared.has(name)) {
      issues.push(`${file} measures ${name}, which names no SLI in the file`);
    }
  }
  return issues;
}

/** Measure the SLO's indicator once, then evaluate each objective. */
export async function measureSlo(input: {
  readonly doc: OpenSloDoc;
  readonly slo: Slo;
  readonly binding: ObjectivesBinding;
}): Promise<readonly ObjectiveResult[]> {
  const { doc, slo, binding } = input;
  const sli = doc.slis.find((candidate) => candidate.name === slo.indicator);
  const measure = binding.measure[slo.indicator];
  if (sli === undefined || measure === undefined) {
    return failAll(
      slo,
      `SLI ${slo.indicator} has no measure — add measure['${slo.indicator}'] to tests/openslo/${binding.spec}.binding.ts`
    );
  }
  const clock = binding.nowMs?.() ?? null;
  let measurement: Measurement;
  try {
    measurement = await measure(measureContext(slo, clock));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return failAll(slo, `the measure for SLI ${sli.name} failed: ${message}`);
  }
  const nowMs = clock ?? latestAt(measurement);
  if (nowMs === null) {
    return failAll(
      slo,
      measurement.kind === 'totals'
        ? `the measure for SLI ${sli.name} returned totals, which need the binding's nowMs to know which window they cover`
        : `no evidence: the measure for SLI ${sli.name} returned nothing`
    );
  }
  return slo.objectives.map((objective) => ({
    id: objectiveId(slo.name, objective.displayName),
    slo: slo.name,
    objective: objective.displayName,
    evaluation: evaluateObjective({ slo, sli, objective, measurement, nowMs }),
  }));
}

/** Parse, check the binding, and evaluate every objective of every SLO. */
export async function checkObjectiveSpec(input: {
  readonly text: string;
  readonly binding: ObjectivesBinding;
}): Promise<{
  readonly issues: readonly string[];
  readonly results: readonly ObjectiveResult[];
}> {
  const parsed = parseOpenSlo(input.text);
  if (!parsed.ok) return { issues: parsed.issues, results: [] };
  const results: ObjectiveResult[] = [];
  for (const slo of parsed.doc.slos) {
    results.push(
      ...(await measureSlo({ doc: parsed.doc, slo, binding: input.binding }))
    );
  }
  return { issues: bindingIssues(parsed.doc, input.binding), results };
}

function measureContext(slo: Slo, clock: number | null): MeasureContext {
  if (clock === null) {
    return {
      nowMs: Number.POSITIVE_INFINITY,
      startMs: Number.NEGATIVE_INFINITY,
      endMs: Number.POSITIVE_INFINITY,
    };
  }
  return { nowMs: clock, ...windowBounds(slo, clock) };
}

function latestAt(measurement: Measurement): number | null {
  if (measurement.kind === 'totals') return null;
  const times =
    measurement.kind === 'events'
      ? measurement.events.map((e) => e.atMs)
      : measurement.samples.map((s) => s.atMs);
  let latest: number | null = null;
  for (const t of times) {
    if (Number.isFinite(t) && (latest === null || t > latest)) latest = t;
  }
  return latest;
}

function failAll(slo: Slo, detail: string): readonly ObjectiveResult[] {
  return slo.objectives.map((objective) => ({
    id: objectiveId(slo.name, objective.displayName),
    slo: slo.name,
    objective: objective.displayName,
    evaluation: {
      met: false,
      observed: null,
      target: objective.target,
      considered: 0,
      detail,
    },
  }));
}
