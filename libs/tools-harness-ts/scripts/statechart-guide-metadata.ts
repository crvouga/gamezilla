import {
  type Composition,
  type MachineConfig,
  type SpecBundle,
  type StateMeta,
  walkStates,
} from '@crvouga/atlas';
import type { AnalysisIssue } from './statechart-composition';
import { chartSources } from './statechart-guide';
import { normalizedMetadata, sameChartData } from './statechart-metadata';
import { withRouteHints } from './statechart-route-hints';

function without(meta: StateMeta | undefined, keys: string[]): StateMeta {
  const result = { ...meta };
  for (const key of keys) delete result[key];
  return result;
}

/** Compiler enrichment has one explicit policy; arbitrary source semantics cannot drift. */
export function guideMetadataProblems(
  bundle: SpecBundle,
  composition: Composition,
  guide: MachineConfig
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const rootKeys = ['description', 'eventKinds', 'contracts'];
  if (
    !sameChartData(
      normalizedMetadata(without(composition.machine.meta, rootKeys)),
      normalizedMetadata(without(guide.meta, rootKeys))
    )
  ) {
    issues.push({
      rule: 'guide-metadata',
      message:
        'Compilation changed protected root metadata or source references',
    });
  }
  if (
    typeof guide.meta?.description !== 'string' ||
    !guide.meta.description.trim()
  ) {
    issues.push({
      rule: 'guide-metadata',
      message: 'The guide requires a readable product description',
    });
  }
  const compiled = new Map(
    walkStates(guide).map(({ name, node }) => [name, node])
  );
  const chartByHost = new Map(
    bundle.charts.flatMap(({ machine }) => {
      const host = composition.hosts.get(machine.id);
      return host ? [[host, machine] as const] : [];
    })
  );
  const stripped = ['checks', 'gherkin', 'contracts'];
  for (const { name, node } of walkStates(composition.machine)) {
    const expected = without(node.meta, stripped);
    const child = chartByHost.get(name);
    if (child) {
      expected.description =
        child.meta?.description ?? expected.description ?? '';
      expected.source = [...chartSources(child)].sort();
    }
    const actual = without(compiled.get(name)?.meta, stripped);
    if (
      !sameChartData(
        normalizedMetadata(withRouteHints(expected)),
        normalizedMetadata(actual)
      )
    ) {
      issues.push({
        rule: 'guide-metadata',
        message: `${name}: compilation changed its description, source references or protected metadata`,
      });
    }
  }
  return issues;
}
