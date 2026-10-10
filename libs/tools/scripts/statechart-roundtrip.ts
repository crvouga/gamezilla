import {
  ChartGraph,
  type Composition,
  configKey,
  type MachineConfig,
  machineToScxml,
  type PlannedPath,
  scxmlToMachine,
  targetOf,
  walkStates,
} from '@crvouga/atlas';
import type { AnalysisIssue } from './statechart-composition';
import { normalizedMetadata } from './statechart-metadata';
import { type ModelReplay, replayModel } from './statechart-replay';

function replaySignature(replay: ModelReplay) {
  return JSON.stringify([
    configKey(replay.config.value),
    replay.problem,
    replay.steps,
  ]);
}

function machineSignature(machine: MachineConfig) {
  return JSON.stringify({
    id: machine.id,
    initial: machine.initial ?? null,
    type: machine.type ?? null,
    meta: normalizedMetadata(machine.meta),
    states: walkStates(machine).map(({ name, node, trail }) => ({
      name,
      id: node.id ?? name,
      trail,
      initial: node.initial ?? null,
      type: node.type ?? null,
      meta: normalizedMetadata(node.meta),
      on: Object.entries(node.on ?? {}).map(([event, target]) => [
        event,
        targetOf(target),
      ]),
    })),
  });
}

/** Every exported path has exactly the same states and events after SCXML import. */
export function roundTripProblems(
  composition: Composition,
  graph: ChartGraph,
  paths: PlannedPath[],
  issues: AnalysisIssue[]
) {
  try {
    const restored = scxmlToMachine(machineToScxml(composition.machine));
    const roundTrip = new ChartGraph(restored, composition.handOffs);
    if (machineSignature(restored) !== machineSignature(composition.machine)) {
      issues.push({
        rule: 'scxml',
        message:
          'SCXML round-trip changed states, nesting, initial states, transitions or metadata',
      });
    }
    for (const path of paths) {
      const events = path.steps
        .filter((step) => !step.handOff)
        .map((step) => step.event);
      const expected = replayModel(graph, graph.initial(), events);
      const actual = replayModel(roundTrip, roundTrip.initial(), events);
      if (replaySignature(actual) !== replaySignature(expected)) {
        issues.push({
          rule: 'scxml',
          message: `${path.name}: SCXML round-trip changed its replay`,
        });
      }
      if (
        JSON.stringify(expected.steps) !== JSON.stringify(path.steps) ||
        expected.problem
      ) {
        issues.push({
          rule: 'plan',
          message: `${path.name}: planned steps cannot replay from the product's initial state`,
        });
      }
    }
  } catch (error) {
    issues.push({ rule: 'scxml', message: String(error) });
  }
}
