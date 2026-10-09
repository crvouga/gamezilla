import {
  ChartGraph,
  composeCharts,
  invokesOf,
  type MachineConfig,
  type PlannedPath,
  pathKey,
  type SpecBundle,
  type StateMeta,
  targetOf,
  walkStates,
} from '@crvouga/atlas';
import {
  type AnalysisIssue,
  compositionProblems,
} from './statechart-composition';
import { sourcePath } from './statechart-contracts';
import { chartSources } from './statechart-guide';
import { guideMetadataProblems } from './statechart-guide-metadata';
import { sameChartData } from './statechart-metadata';
import { replayModel } from './statechart-replay';
import { roundTripProblems } from './statechart-roundtrip';

export type GuideIntegrityOptions = {
  contracts: readonly NonNullable<StateMeta['contracts']>[number][];
  tour: string;
  gapSources?: readonly string[];
  paths?: readonly PlannedPath[];
};

function topology(machine: MachineConfig) {
  return {
    id: machine.id,
    initial: machine.initial,
    type: machine.type,
    states: walkStates(machine).map(({ name, node, trail }) => ({
      name,
      trail,
      id: node.id ?? name,
      initial: node.initial,
      type: node.type,
      on: Object.entries(node.on ?? {}).map(([event, target]) => [
        event,
        targetOf(target),
      ]),
    })),
  };
}

function eventKindProblems(
  bundle: SpecBundle,
  guide: MachineConfig,
  issues: AnalysisIssue[]
) {
  const kinds = guide.meta?.['eventKinds'];
  if (!kinds || typeof kinds !== 'object' || Array.isArray(kinds)) {
    issues.push({
      rule: 'event-kind',
      message: 'The guide has no explicit event kinds',
    });
    return;
  }
  const map = new Map(Object.entries(kinds));
  const validKinds = ['user', 'system', 'time', 'hand-off'];
  for (const [event, kind] of map) {
    if (typeof kind !== 'string' || !validKinds.includes(kind)) {
      issues.push({
        rule: 'event-kind',
        message: `Event "${event}" has an invalid explicit kind`,
      });
    }
  }
  const used = new Set(
    walkStates(guide).flatMap(({ node }) => Object.keys(node.on ?? {}))
  );
  for (const event of used) {
    const kind = map.get(event);
    if (typeof kind !== 'string' || !validKinds.includes(kind)) {
      issues.push({
        rule: 'event-kind',
        message: `Used event "${event}" has no valid explicit kind`,
      });
    }
  }
  for (const chart of bundle.charts) {
    const authored = chart.machine.meta?.['eventKinds'];
    if (authored === undefined) continue;
    if (!authored || typeof authored !== 'object' || Array.isArray(authored)) {
      issues.push({
        rule: 'event-kind',
        message: `${chart.machine.id}: authored event kinds must be an event-to-kind map`,
      });
      continue;
    }
    for (const [event, kind] of Object.entries(authored)) {
      if (used.has(event) && map.get(event) !== kind) {
        issues.push({
          rule: 'event-kind',
          message: `${chart.machine.id}: "${event}" disagrees with the compiled event kind`,
        });
      }
    }
  }
}

function contractProblems(
  composition: ReturnType<typeof composeCharts>,
  bundle: SpecBundle,
  guide: MachineConfig,
  options: GuideIntegrityOptions
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const ids = new Set<string>();
  for (const contract of options.contracts) {
    if (ids.has(contract.id))
      issues.push({
        rule: 'contract',
        message: `Duplicate rule card id: ${contract.id}`,
      });
    ids.add(contract.id);
  }
  if (!sameChartData(guide.meta?.contracts, options.contracts)) {
    issues.push({
      rule: 'contract',
      message: 'The product guide changed or dropped source-derived rule cards',
    });
  }
  const nodes = new Map(
    walkStates(guide).map(({ name, node }) => [name, node])
  );
  for (const chart of bundle.charts) {
    const host = composition.hosts.get(chart.machine.id);
    if (!host) continue;
    const sources = chartSources(chart.machine);
    const expected = options.contracts.filter((contract) =>
      sources.has(sourcePath(contract.source))
    );
    if (!sameChartData(nodes.get(host)?.meta?.contracts, expected)) {
      issues.push({
        rule: 'contract',
        message: `${chart.machine.id}: the owning capability lost or changed its rule cards`,
      });
    }
  }
  for (const path of options.gapSources ?? []) {
    const notes =
      guide.meta?.contracts?.filter(
        (contract) => sourcePath(contract.source) === path
      ) ?? [];
    const visible = notes.some((contract) =>
      contract.steps.some((step) => step.docString?.trim())
    );
    if (!visible)
      issues.push({
        rule: 'gap',
        message: `Contract gaps and scope must remain visible from ${path}`,
      });
  }
  return issues;
}

function tourProblems(
  bundle: SpecBundle,
  composition: ReturnType<typeof composeCharts>,
  graph: ChartGraph,
  name: string
): AnalysisIssue[] {
  const journey = bundle.journeys.find((item) => item.name === name);
  if (!journey)
    return [
      { rule: 'tour', message: `Missing complete product tour: ${name}` },
    ];
  const replay = replayModel(graph, graph.initial(), journey.events);
  if (replay.problem)
    return [{ rule: 'tour', message: `${name}: ${replay.problem}` }];
  const reached = new Set(
    replay.configurations.flatMap((config) =>
      config.active.map((state) => composition.chartOf.get(state))
    )
  );
  return [...composition.hosts.keys()]
    .filter((id) => !reached.has(id))
    .map((id) => ({
      rule: 'tour',
      message: `${name} never enters the composed module "${id}"`,
    }));
}

type ReplaySequence = {
  name: string;
  events: readonly string[];
  planned?: PlannedPath;
};

function replayProblems(
  original: ChartGraph,
  compiled: ChartGraph,
  sequences: ReplaySequence[]
) {
  const issues: AnalysisIssue[] = [];
  for (const sequence of sequences) {
    const initial = original.initial();
    const before = replayModel(original, initial, sequence.events);
    const after = replayModel(compiled, compiled.initial(), sequence.events);
    if (!sameChartData(before, after)) {
      issues.push({
        rule: 'guide-replay',
        message: `${sequence.name}: compilation changed the product's replay`,
      });
    }
    if (
      sequence.planned &&
      (sequence.planned.seed !== undefined ||
        !sameChartData(sequence.planned.start, initial.active) ||
        !sameChartData(sequence.planned.steps, before.steps) ||
        before.problem)
    ) {
      issues.push({
        rule: 'guide-path',
        message: `${sequence.name}: supplied path does not replay from the product's canonical beginning`,
      });
    }
  }
  return issues;
}

function replaySequences(
  bundle: SpecBundle,
  paths: readonly PlannedPath[]
): ReplaySequence[] {
  return [
    ...bundle.journeys.map(({ name, events }) => ({ name, events })),
    ...paths.map((planned) => ({
      name: planned.name,
      events: planned.steps
        .filter((step) => !step.handOff)
        .map((step) => step.event),
      planned,
    })),
  ];
}

function journeyPaths(bundle: SpecBundle, graph: ChartGraph): PlannedPath[] {
  return bundle.journeys.map((journey, index) => {
    const initial = graph.initial();
    const replay = replayModel(graph, initial, journey.events);
    return {
      id: `guide-journey-${index + 1}`,
      key: pathKey(undefined, initial, journey.events),
      name: journey.name,
      description: journey.description,
      kind: 'journey',
      steps: replay.steps,
      start: initial.active,
      blockedBy: replay.problem ? [replay.problem] : [],
    };
  });
}

/** Validate the exact portable artifact, not merely its authored inputs. */
export function guideIntegrityProblems(
  bundle: SpecBundle,
  guide: MachineConfig,
  options: GuideIntegrityOptions
): AnalysisIssue[] {
  const preflight = compositionProblems({
    directory: bundle.directory,
    root: guide.id,
    charts: [
      { file: 'product.machine.json', format: 'xstate', machine: guide },
    ],
    journeys: bundle.journeys,
  });
  if (preflight.length)
    return preflight.map(({ rule, message }) => ({
      rule: 'guide-pure',
      message: `${rule}: ${message}`,
    }));
  const composition = composeCharts(bundle);
  const original = new ChartGraph(composition.machine, composition.handOffs);
  const compiled = new ChartGraph(guide);
  const issues = contractProblems(composition, bundle, guide, options);
  issues.push(...guideMetadataProblems(bundle, composition, guide));
  if (!sameChartData(topology(composition.machine), topology(guide))) {
    issues.push({
      rule: 'guide-graph',
      message: 'Compilation changed the product graph',
    });
  }
  if (
    [guide, ...walkStates(guide).map(({ node }) => node)].some(
      (node) => invokesOf(node).length
    )
  ) {
    issues.push({
      rule: 'guide-graph',
      message: 'The portable guide must contain one fully inlined chart',
    });
  }
  const paths = options.paths ?? [];
  issues.push(
    ...replayProblems(original, compiled, replaySequences(bundle, paths))
  );
  if (composition.handOffs.length) {
    issues.push({
      rule: 'guide-handoff',
      message:
        'Automatic child hand-offs have no preserved runtime mapping in the single-chart portable guide',
    });
  }
  issues.push(...tourProblems(bundle, composition, original, options.tour));
  eventKindProblems(bundle, guide, issues);
  roundTripProblems(
    { ...composition, machine: guide, handOffs: [] },
    compiled,
    [...journeyPaths(bundle, compiled), ...paths],
    issues
  );
  return issues;
}
