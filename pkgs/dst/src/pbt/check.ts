import fc from 'fast-check';

import type { Action } from '../harness/actions';
import type { AnyScenarioDef } from '../harness/define-scenario';
import type { Example, FailureReport, Repro } from '../harness/repro';
import { RELIABLE_NETWORK } from '../models/network';
import { arbKnobs, arbSeed } from './arbs';
import { assertDeterministic } from './assert-deterministic';
import {
  assertVacuity,
  buildCoverageReport,
  mergeCoverageMaps,
  VacuityError,
} from './coverage';
import { runProperty } from './run-property';
import { deltaDebugShrink } from './shrink';
import { walkEpisode } from './walk';

export type CheckOptions = {
  readonly episodes?: number;
  readonly episodeLength?: number;
  readonly shrink?: boolean;
  readonly swarm?: boolean;
  readonly vacuity?: 'fail' | 'warn';
  readonly budgetMs?: number;
};

export type CampaignReport = {
  readonly episodes: number;
  readonly coverage: import('../harness/repro').CoverageReport;
  readonly failures: readonly FailureReport[];
};

export class CheckFailedError extends Error {
  readonly report: CampaignReport;

  constructor(message: string, report: CampaignReport) {
    super(message);
    this.name = 'CheckFailedError';
    this.report = report;
  }
}

function swarmMask(
  kinds: readonly string[],
  episodeIndex: number
): readonly string[] {
  const out = kinds.filter((_, i) => (episodeIndex + i) % 2 === 0);
  return out.length > 0 ? out : kinds;
}

async function recordWalkFailure(args: {
  readonly scenario: AnyScenarioDef;
  readonly seed: number | bigint | string;
  readonly knobs: Record<string, import('../kernel/json').JsonValue>;
  readonly swarm?: readonly string[];
  readonly shrinkEnabled: boolean;
  readonly error: unknown;
  readonly failures: FailureReport[];
}): Promise<never> {
  const { scenario, seed, knobs, swarm, shrinkEnabled, error, failures } = args;
  let actions: Action[] = [];
  if (shrinkEnabled) {
    try {
      actions = await deltaDebugShrink({ scenario, seed, knobs, actions });
    } catch {
      /* no recorded actions */
    }
  }
  let repro: Repro<Action>;
  let trace: FailureReport['trace'] = [];
  try {
    const result = await assertDeterministic(scenario, {
      seed,
      knobs,
      actions,
    });
    repro = result.repro;
    trace = result.trace;
    await result.world.dispose();
  } catch {
    repro = {
      version: 3,
      inputs: {
        seed: String(seed),
        startTime: 0,
        knobs,
        actions,
        networkFaults: RELIABLE_NETWORK,
        ...(swarm !== undefined ? { swarm } : {}),
      },
      meta: { scenarioId: scenario.id },
    };
  }
  failures.push({
    repro,
    trace,
    error: error instanceof Error ? error.message : String(error),
  });
  throw error;
}

export async function check(
  scenario: AnyScenarioDef,
  opts?: CheckOptions
): Promise<CampaignReport> {
  const episodeLength = opts?.episodeLength ?? 14;
  const shrinkEnabled = opts?.shrink ?? true;
  const vacuity = opts?.vacuity ?? 'fail';
  const failures: FailureReport[] = [];
  let propertySometimes = new Map<string, number>();
  let episodesRun = 0;
  const kinds = Object.keys(scenario.actions);

  try {
    await runProperty(
      scenario.id,
      fc.asyncProperty(
        fc
          .tuple(arbSeed(), arbKnobs(scenario))
          .chain(([seed, knobs]) =>
            fc.tuple(fc.constant(seed), fc.constant(knobs), fc.nat(999_999))
          ),
        async ([seed, knobs, episodeIndex]) => {
          episodesRun += 1;
          const swarm =
            opts?.swarm === true ? swarmMask(kinds, episodeIndex) : undefined;
          let walked;
          try {
            walked = await walkEpisode({
              scenario,
              seed,
              knobs,
              episodeIndex,
              episodeLength,
              ...(swarm !== undefined ? { swarm } : {}),
            });
          } catch (e) {
            await recordWalkFailure({
              scenario,
              seed,
              knobs,
              ...(swarm !== undefined ? { swarm } : {}),
              shrinkEnabled,
              error: e,
              failures,
            });
          }

          propertySometimes = mergeCoverageMaps(
            propertySometimes,
            new Map(walked.sometimesHits)
          );
        }
      ),
      {
        ...(opts?.episodes !== undefined ? { numRuns: opts.episodes } : {}),
        ...(opts?.budgetMs !== undefined
          ? { interruptAfterTimeLimit: opts.budgetMs }
          : {}),
      }
    );
  } catch (e) {
    const coverage = buildCoverageReport({
      propertySometimes,
      properties: scenario.properties,
    });
    const report: CampaignReport = {
      episodes: episodesRun,
      coverage,
      failures,
    };
    if (failures.length > 0) {
      throw new CheckFailedError(
        e instanceof Error ? e.message : String(e),
        report
      );
    }
    throw e;
  }

  const coverage = assertVacuity({
    properties: scenario.properties,
    propertySometimes,
    mode: vacuity,
  });

  return { episodes: episodesRun, coverage, failures };
}

export async function runExamples(
  scenario: AnyScenarioDef,
  examples: readonly Example[],
  opts?: { readonly seeds?: readonly (number | bigint | string)[] }
): Promise<void> {
  const seeds = opts?.seeds ?? [1];
  for (const example of examples) {
    for (const seed of seeds) {
      const resolvedSeed = example.inputs.seed ?? seed;
      const { world } = await assertDeterministic(scenario, {
        seed: resolvedSeed,
        knobs: example.inputs.knobs,
        actions: example.inputs.actions as Action[],
        networkFaults: example.inputs.networkFaults,
      });
      await world.dispose();
    }
  }
}

export { VacuityError };
