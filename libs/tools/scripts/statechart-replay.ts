import {
  type ChartGraph,
  type Config,
  configKey,
  type PlannedStep,
} from '@crvouga/atlas';

export type ModelReplay = {
  config: Config;
  steps: PlannedStep[];
  configurations: Config[];
  problem: string | null;
};

function appendStep(
  replay: ModelReplay,
  event: string,
  next: { config: Config; fired: string[] },
  handOff: boolean
) {
  replay.steps.push({
    event,
    transitions: next.fired,
    handOff,
    from: replay.config.active,
    to: next.config.active,
  });
  replay.config = next.config;
  replay.configurations.push(next.config);
}

function settle(graph: ChartGraph, replay: ModelReplay) {
  const visited = new Set<string>();
  for (;;) {
    const pending = graph.pendingHandOffs(replay.config)[0];
    if (!pending) return;
    const key = configKey(replay.config.value);
    if (visited.has(key)) {
      replay.problem = `Automatic hand-off cycle at ${pending.state}`;
      return;
    }
    visited.add(key);
    const next = graph.step(replay.config, pending.event);
    if (!next) {
      replay.problem = `Automatic hand-off ${pending.event} cannot leave ${pending.state}`;
      return;
    }
    appendStep(replay, pending.event, next, true);
  }
}

/** Bounded automatic settlement prevents a malformed final hand-off hanging CI. */
export function replayModel(
  graph: ChartGraph,
  start: Config,
  events: readonly string[]
): ModelReplay {
  const replay: ModelReplay = {
    config: start,
    steps: [],
    configurations: [start],
    problem: null,
  };
  settle(graph, replay);
  for (const event of events) {
    if (replay.problem) break;
    const next = graph.step(replay.config, event);
    if (!next) {
      replay.problem = `"${event}" does not apply in ${configKey(replay.config.value)}`;
      break;
    }
    appendStep(replay, event, next, false);
    settle(graph, replay);
  }
  return replay;
}

export type ReachedConfiguration = { config: Config; events: string[] };
export type ModelExploration = {
  seen: Map<string, ReachedConfiguration>;
  observed: Map<string, ReachedConfiguration>;
  statePaths: Map<string, string[]>;
  transitionPaths: Map<string, string[]>;
  complete: boolean;
  problems: string[];
};

function remember(
  exploration: ModelExploration,
  replay: ModelReplay,
  events: string[]
) {
  for (const config of replay.configurations) {
    const key = configKey(config.value);
    if (!exploration.observed.has(key))
      exploration.observed.set(key, { config, events });
    for (const name of config.active) {
      if (!exploration.statePaths.has(name))
        exploration.statePaths.set(name, events);
    }
  }
  for (const step of replay.steps) {
    for (const id of step.transitions) {
      if (!exploration.transitionPaths.has(id))
        exploration.transitionPaths.set(id, events);
    }
  }
}

/** Exhaustive BFS has an explicit budget verdict; no partial walk claims completeness. */
export function exploreModel(
  graph: ChartGraph,
  maxConfigurations: number
): ModelExploration {
  const first = replayModel(graph, graph.initial(), []);
  const exploration: ModelExploration = {
    seen: new Map([
      [configKey(first.config.value), { config: first.config, events: [] }],
    ]),
    observed: new Map(),
    statePaths: new Map(),
    transitionPaths: new Map(),
    complete: true,
    problems: [],
  };
  remember(exploration, first, []);
  const queue = [...exploration.seen.values()];
  if (first.problem) exploration.problems.push(first.problem);
  for (
    let head = 0;
    head < queue.length && !exploration.problems.length;
    head++
  ) {
    const current = queue[head];
    if (!current) break;
    for (const event of graph.enabledEvents(current.config)) {
      const replay = replayModel(graph, current.config, [event]);
      const events = [...current.events, event];
      remember(exploration, replay, events);
      if (replay.problem) {
        exploration.problems.push(replay.problem);
        break;
      }
      const key = configKey(replay.config.value);
      if (exploration.seen.has(key)) continue;
      if (exploration.seen.size >= maxConfigurations) {
        exploration.complete = false;
        continue;
      }
      const reached = { config: replay.config, events };
      exploration.seen.set(key, reached);
      queue.push(reached);
    }
  }
  if (exploration.problems.length) exploration.complete = false;
  return exploration;
}
