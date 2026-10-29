import {
  composeCharts,
  type MachineConfig,
  type SpecBundle,
  type StateConfig,
  walkStates,
} from '@crvouga/atlas';
import { type ProductContract, sourcePath } from './statechart-contracts';
import { withRouteHints } from './statechart-route-hints';

/** Attach source-derived rules at capability boundaries, never fake evidence. */
export function productGuide(
  bundle: SpecBundle,
  contracts: readonly ProductContract[]
): MachineConfig {
  const composition = composeCharts(bundle);
  const machine = structuredClone(composition.machine);
  machine.meta = {
    ...machine.meta,
    contracts: [...contracts],
    eventKinds: productEventKinds(bundle),
    description:
      'Explore the product: choose an action, read its outcome and rules, or find a route to any capability. Everything runs from the product model, without the application server.',
  };
  const nodes = new Map(
    walkStates(machine).map(({ name, node }) => [name, node])
  );
  for (const chart of bundle.charts) {
    const host = composition.hosts.get(chart.machine.id);
    if (!host) continue;
    const node = nodes.get(host);
    if (!node) throw new Error(`Missing capability host: ${host}`);
    const references = chartSources(chart.machine);
    const catalog = contracts.filter((contract) =>
      references.has(sourcePath(contract.source))
    );
    node.meta = {
      ...node.meta,
      description:
        chart.machine.meta?.description ?? node.meta?.description ?? '',
      source: [...references].sort(),
      contracts: catalog,
    };
  }
  // Existing verification titles are traceability labels, not screen assertions.
  for (const { node } of walkStates(machine)) {
    if (node.meta) {
      delete node.meta.checks;
      delete node.meta['gherkin'];
      node.meta = withRouteHints(node.meta);
    }
  }
  return machine;
}

export function chartSources(machine: MachineConfig): Set<string> {
  const nodes: StateConfig[] = [
    machine,
    ...walkStates(machine).map(({ node }) => node),
  ];
  const sources = nodes.flatMap((node) =>
    (node.meta?.source ?? []).map(sourcePath)
  );
  const context = machine.meta?.['context'];
  if (typeof context === 'string' && context !== 'kernel')
    sources.push(`specs/${context}/ubiquitous-language.yml`);
  sources.push('specs/ubiquitous-language.yml');
  return new Set(sources);
}

function productEventKinds(bundle: SpecBundle): Record<string, string> {
  const kinds: Record<string, string> = {};
  // The modules own their events; verification disagreements before adding root-only events.
  for (const chart of bundle.charts.filter(
    (chart) => chart.machine.id !== bundle.root
  )) {
    const map = chart.machine.meta?.['eventKinds'];
    if (typeof map !== 'object' || !map) continue;
    for (const [event, kind] of Object.entries(map)) {
      if (
        typeof kind !== 'string' ||
        !['user', 'system', 'time', 'hand-off'].includes(kind)
      )
        throw new Error(`Invalid event kind: ${event}`);
      if (kinds[event] && kinds[event] !== kind)
        throw new Error(
          `Conflicting event kind for ${event}: ${kinds[event]} and ${kind}`
        );
      kinds[event] = kind;
    }
  }
  const rootKinds = bundle.charts.find(
    (chart) => chart.machine.id === bundle.root
  )?.machine.meta?.['eventKinds'];
  if (rootKinds && typeof rootKinds === 'object') {
    for (const [event, kind] of Object.entries(rootKinds)) {
      if (typeof kind === 'string' && !kinds[event]) kinds[event] = kind;
    }
  }
  return kinds;
}

/** A new authoritative contract without a chart owner fails the build. */
export function unmappedContracts(
  bundle: SpecBundle,
  contracts: readonly ProductContract[]
): string[] {
  const owned = new Set(
    bundle.charts.flatMap((chart) => [...chartSources(chart.machine)])
  );
  return [
    ...new Set(contracts.map((contract) => sourcePath(contract.source))),
  ].filter((path) => !owned.has(path));
}
