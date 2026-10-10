import {
  ChartGraph,
  composeCharts,
  lintBundle,
  type MachineConfig,
  type PlannedPath,
  pathKey,
  type SpecBundle,
  type StateMeta,
  targetOf,
  transitionId,
  walkStates,
} from '@crvouga/atlas';
import {
  type AnalysisIssue,
  compositionProblems,
} from './statechart-composition';
import {
  exploreModel,
  type ModelExploration,
  replayModel,
} from './statechart-replay';
import { roundTripProblems } from './statechart-roundtrip';

export type StateSummary = {
  name: string;
  id: string;
  chart: string;
  parent: string | null;
  meta: StateMeta;
  reachable: boolean;
  shortestPath: string[] | null;
};
export type TransitionSummary = {
  id: string;
  source: string;
  event: string;
  target: string;
  reachable: boolean;
  shortestPath: string[] | null;
};
export type JourneySummary = {
  name: string;
  description: string;
  events: string[];
  endsIn: string[];
  actualEnd: string[];
  valid: boolean;
  path: string | null;
};
export type StatechartAnalysis = {
  root: string;
  machine: MachineConfig | null;
  states: StateSummary[];
  transitions: TransitionSummary[];
  configurations: number;
  journeys: JourneySummary[];
  paths: PlannedPath[];
  routePaths: Record<string, string[]>;
  coverage: {
    reachableStates: number;
    reachableTransitions: number;
    plannedTransitions: number;
  };
  complete: boolean;
  issues: AnalysisIssue[];
};
export type AnalysisOptions = {
  sourceFiles?: ReadonlyMap<string, string>;
  maxConfigurations?: number;
  identity?: { guest: string[]; deleted: string[]; paid: string[] };
};

function emptyAnalysis(
  root: string,
  issues: AnalysisIssue[]
): StatechartAnalysis {
  return {
    root,
    machine: null,
    states: [],
    transitions: [],
    configurations: 0,
    journeys: [],
    paths: [],
    routePaths: {},
    complete: false,
    issues,
    coverage: {
      reachableStates: 0,
      reachableTransitions: 0,
      plannedTransitions: 0,
    },
  };
}

function stateSummaries(
  composition: ReturnType<typeof composeCharts>,
  exploration: ModelExploration
): StateSummary[] {
  return walkStates(composition.machine).map(({ name, node, trail }) => ({
    name,
    id: node.id ?? name,
    chart: composition.chartOf.get(name) ?? '',
    parent: trail.at(-1) ?? null,
    meta: node.meta ?? {},
    reachable: exploration.statePaths.has(name),
    shortestPath: exploration.statePaths.get(name) ?? null,
  }));
}

function transitionSummaries(
  machine: MachineConfig,
  exploration: ModelExploration
): TransitionSummary[] {
  return walkStates(machine).flatMap(({ name, node }) =>
    Object.entries(node.on ?? {}).map(([event, target]) => {
      const id = transitionId(name, event);
      return {
        id,
        source: name,
        event,
        target: targetOf(target) ?? '',
        reachable: exploration.transitionPaths.has(id),
        shortestPath: exploration.transitionPaths.get(id) ?? null,
      };
    })
  );
}

function addPath(
  paths: PlannedPath[],
  graph: ChartGraph,
  events: string[],
  details: Pick<PlannedPath, 'name' | 'description' | 'kind'> & {
    journey?: string;
  }
): PlannedPath {
  const { journey, ...labels } = details;
  const initial = graph.initial();
  const replay = replayModel(graph, initial, events);
  const key = pathKey(undefined, initial, events);
  const existing = paths.find((path) => path.key === key);
  if (existing) {
    if (journey && !existing.journeys?.includes(journey)) {
      existing.journeys = [...(existing.journeys ?? []), journey];
    }
    return existing;
  }
  const path: PlannedPath = {
    ...labels,
    id: `${details.kind}-${paths.length + 1}`,
    key,
    steps: replay.steps,
    start: initial.active,
    blockedBy: replay.problem ? [replay.problem] : [],
    ...(journey ? { journeys: [journey] } : {}),
  };
  paths.push(path);
  return path;
}

function journeySummaries(
  bundle: SpecBundle,
  graph: ChartGraph,
  paths: PlannedPath[],
  issues: AnalysisIssue[]
): JourneySummary[] {
  return bundle.journeys.map((journey) => {
    const replay = replayModel(graph, graph.initial(), journey.events);
    const missing = journey.endsIn.filter(
      (name) => !replay.config.active.includes(name)
    );
    const problem =
      replay.problem ??
      (missing.length ? `Expected ${missing.join(', ')}` : null);
    if (problem)
      issues.push({ rule: 'journey', message: `${journey.name}: ${problem}` });
    const path = problem
      ? null
      : addPath(paths, graph, journey.events, {
          name: journey.name,
          description: journey.description,
          kind: 'journey',
          journey: journey.name,
        }).id;
    return {
      ...journey,
      actualEnd: replay.config.active,
      valid: problem === null,
      path,
    };
  });
}

function generatedPaths(
  graph: ChartGraph,
  transitions: TransitionSummary[],
  paths: PlannedPath[],
  issues: AnalysisIssue[]
) {
  const covered = new Set(
    paths.flatMap((path) => path.steps.flatMap((step) => step.transitions))
  );
  for (const transition of transitions) {
    if (covered.has(transition.id)) continue;
    if (!transition.shortestPath) {
      issues.push({
        rule: 'transition',
        message: `${transition.id} cannot be reached`,
      });
      continue;
    }
    const path = addPath(paths, graph, transition.shortestPath, {
      name: `Covers: ${transition.source} → ${transition.event}`,
      description:
        'Shortest path from the beginning of the product to this choice.',
      kind: 'generated',
    });
    for (const step of path.steps)
      for (const id of step.transitions) covered.add(id);
    if (!covered.has(transition.id)) {
      issues.push({
        rule: 'plan',
        message: `${transition.id}: its generated path does not take it`,
      });
    }
  }
}

const DEFAULT_IDENTITY = {
  guest: ['Identity: Guest'],
  deleted: ['Identity: Deleted account'],
  paid: ['Access: Paid access'],
};

function identityProblems(
  graph: ChartGraph,
  exploration: ModelExploration,
  identity: NonNullable<AnalysisOptions['identity']>,
  issues: AnalysisIssue[]
) {
  const forbidden = [...identity.guest, ...identity.deleted];
  for (const reached of exploration.observed.values()) {
    if (!reached.config.active.some((name) => forbidden.includes(name)))
      continue;
    if (reached.config.active.some((name) => identity.paid.includes(name))) {
      issues.push({
        rule: 'identity',
        message: `Guest or deleted identity has paid access after ${reached.events.join(' → ') || 'opening the app'}`,
      });
      break;
    }
  }
  for (const name of [...forbidden, ...identity.paid]) {
    if (!graph.stateNames().includes(name)) {
      issues.push({
        rule: 'identity',
        message: `Identity invariant names absent state "${name}"`,
      });
    }
  }
}

function reachabilityProblems(states: StateSummary[], issues: AnalysisIssue[]) {
  for (const state of states) {
    if (!state.reachable)
      issues.push({
        rule: 'reachable',
        message: `${state.name} is unreachable`,
      });
  }
}

/** Structural chart evidence is independent of product execution evidence. */
export function analyzeStatecharts(
  bundle: SpecBundle,
  options: AnalysisOptions = {}
): StatechartAnalysis {
  const issues = compositionProblems(bundle, options.sourceFiles);
  if (
    issues.some(({ rule }) =>
      ['unique', 'identity', 'composition', 'root', 'pure'].includes(rule)
    )
  ) {
    return emptyAnalysis(bundle.root, issues);
  }
  try {
    return analyzeComposition(bundle, options, issues);
  } catch (error) {
    issues.push({ rule: 'composition', message: String(error) });
    return emptyAnalysis(bundle.root, issues);
  }
}

function analyzeComposition(
  bundle: SpecBundle,
  options: AnalysisOptions,
  issues: AnalysisIssue[]
): StatechartAnalysis {
  const composition = composeCharts(bundle);
  const graph = new ChartGraph(composition.machine, composition.handOffs);
  const limit = options.maxConfigurations ?? 20_000;
  if (!Number.isSafeInteger(limit) || limit < 1)
    throw new Error('maxConfigurations must be a positive safe integer');
  const exploration = exploreModel(graph, limit);
  for (const message of exploration.problems)
    issues.push({ rule: 'automatic', message });
  if (!exploration.complete)
    issues.push({
      rule: 'budget',
      message: `Exploration is incomplete at its ${limit}-configuration budget`,
    });
  const states = stateSummaries(composition, exploration);
  const transitions = transitionSummaries(composition.machine, exploration);
  const paths: PlannedPath[] = [];
  const journeys = journeySummaries(bundle, graph, paths, issues);
  generatedPaths(graph, transitions, paths, issues);
  reachabilityProblems(states, issues);
  const hasIdentity = [...Object.values(DEFAULT_IDENTITY).flat()].some((name) =>
    graph.stateNames().includes(name)
  );
  if (options.identity || hasIdentity)
    identityProblems(
      graph,
      exploration,
      options.identity ?? DEFAULT_IDENTITY,
      issues
    );
  if (!exploration.problems.length) {
    const lint = lintBundle(bundle);
    issues.push(
      ...lint.findings.filter(
        ({ rule }) => rule !== 'reachable' && rule !== 'journey'
      )
    );
  }
  roundTripProblems(composition, graph, paths, issues);
  return assembledAnalysis(bundle, composition, exploration, {
    states,
    transitions,
    journeys,
    paths,
    routePaths: shortestRoutePaths(states),
    issues,
  });
}

function shortestRoutePaths(states: StateSummary[]): Record<string, string[]> {
  const paths: Record<string, string[]> = {};
  for (const state of states) {
    if (!state.shortestPath) continue;
    const listed = state.meta['routes'];
    const routes = [
      state.meta['route'],
      ...(Array.isArray(listed) ? listed : []),
    ];
    for (const route of routes) {
      if (typeof route !== 'string' || !route) continue;
      if (!paths[route] || state.shortestPath.length < paths[route].length)
        paths[route] = state.shortestPath;
    }
  }
  return paths;
}

function assembledAnalysis(
  bundle: SpecBundle,
  composition: ReturnType<typeof composeCharts>,
  exploration: ModelExploration,
  details: Pick<
    StatechartAnalysis,
    'states' | 'transitions' | 'journeys' | 'paths' | 'routePaths' | 'issues'
  >
): StatechartAnalysis {
  return {
    root: bundle.root,
    machine: composition.machine,
    ...details,
    configurations: exploration.seen.size,
    complete: exploration.complete,
    coverage: {
      reachableStates: details.states.filter((state) => state.reachable).length,
      reachableTransitions: details.transitions.filter(
        (transition) => transition.reachable
      ).length,
      plannedTransitions: new Set(
        details.paths.flatMap((path) =>
          path.steps.flatMap((step) => step.transitions)
        )
      ).size,
    },
  };
}
