import { currentInvariantSink } from '@pkgs/invariants';

import type { PropertyCatalog } from '../harness/property';
import type { CoverageReport } from '../harness/repro';

export class VacuityError extends Error {
  readonly starvedIds: readonly string[];
  readonly coverage: CoverageReport;

  constructor(starvedIds: readonly string[], coverage: CoverageReport) {
    super(`VacuityError: starved claims: ${starvedIds.join(', ')}`);
    this.name = 'VacuityError';
    this.starvedIds = starvedIds;
    this.coverage = coverage;
  }
}

export function mergeCoverageMaps(
  a: Map<string, number>,
  b: Map<string, number>
): Map<string, number> {
  const out = new Map(a);
  for (const [id, n] of b) {
    out.set(id, (out.get(id) ?? 0) + n);
  }
  return out;
}

export function buildCoverageReport(args: {
  readonly propertySometimes: ReadonlyMap<string, number>;
  readonly properties: PropertyCatalog;
}): CoverageReport {
  const invSometimes = currentInvariantSink().sometimesHits();
  const invReachable = currentInvariantSink().reachableHits();
  const properties: Record<string, number> = {};
  for (const [id, def] of Object.entries(args.properties)) {
    if (def.kind === 'sometimes') {
      properties[id] = args.propertySometimes.get(id) ?? 0;
    }
  }
  const invariants: Record<string, number> = {};
  for (const [id, n] of invSometimes) invariants[id] = n;
  for (const [id, n] of invReachable) {
    invariants[id] = (invariants[id] ?? 0) + n;
  }
  return { properties, invariants };
}

export function assertVacuity(args: {
  readonly properties: PropertyCatalog;
  readonly propertySometimes: ReadonlyMap<string, number>;
  readonly mode: 'fail' | 'warn';
}): CoverageReport {
  const coverage = buildCoverageReport({
    propertySometimes: args.propertySometimes,
    properties: args.properties,
  });
  const starved: string[] = [];
  for (const [id, def] of Object.entries(args.properties)) {
    if (
      def.kind === 'sometimes' &&
      (args.propertySometimes.get(id) ?? 0) === 0
    ) {
      starved.push(id);
    }
  }
  const invSometimes = currentInvariantSink().sometimesHits();
  const invReachable = currentInvariantSink().reachableHits();
  for (const id of new Set([...invSometimes.keys(), ...invReachable.keys()])) {
    const hits = (invSometimes.get(id) ?? 0) + (invReachable.get(id) ?? 0);
    if (hits === 0) starved.push(`invariant:${id}`);
  }
  if (starved.length > 0 && args.mode === 'fail') {
    throw new VacuityError(starved, coverage);
  }
  return coverage;
}
