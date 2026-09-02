import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import type { Command } from '../harness/command';
import type { AnyScenarioDef } from '../harness/define-scenario';
import { openWorld } from '../harness/world';
import type { World } from '../harness/world-types';
import type { JsonValue } from '../kernel/json';
import { nodeIdsReader } from '../models/node';
import { arbKnobs, arbSeed } from './arbs';
import { assertDeterministic } from './assert-deterministic';
import { replay } from './replay';
import { runProperty } from './run-property';

type Recorded = { commands: Command[] };

/**
 * TODO(dst-audit): the reference model is consulted only as a precondition
 * filter before the World starts (fc.commands + asyncModelRun). D5 / Phase 4
 * moves generation onto the Choice stream and checks postconditions per step.
 */
function buildModelCommands(
  scenario: AnyScenarioDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<AsyncCommand<object, Recorded>>[] {
  const nodeIds = nodeIdsReader(scenario.nodes, knobs);
  const edges = scenario.network?.edges ?? [];
  const ctx = { nodeIds, knobs, edges };
  const out: fc.Arbitrary<AsyncCommand<object, Recorded>>[] = [];

  for (const [kind, def] of Object.entries(scenario.commands)) {
    const weight = def.weight ?? 1;
    if (weight <= 0) continue;
    const precondition = def.precondition ?? (() => true);
    const applyToModel = def.applyToModel ?? (() => undefined);
    const arb = def.generate(ctx).map((payload) => {
      const c = {
        ...(payload as Record<string, JsonValue>),
        kind,
      } as Command;
      return {
        check: (m: object) => precondition(m, c as never),
        run: async (m: object, r: Recorded) => {
          applyToModel(m, c as never);
          r.commands.push(c);
        },
        toString: () => JSON.stringify(c),
      };
    });
    for (let i = 0; i < weight; i += 1) out.push(arb);
  }

  if (out.length === 0) {
    throw new Error(`runScenario(${scenario.id}): commands must be non-empty`);
  }
  return out;
}

export type RunScenarioOptions = {
  readonly maxCommands?: number;
  readonly numRuns?: number;
  readonly interruptAfterTimeLimit?: number;
};

/**
 * Runner: sample seed + knobs + a reference-model-filtered Command sequence,
 * apply it to a fresh World, converge, then re-run under replay to prove
 * the execution is deterministic.
 */
export async function runScenario(
  scenario: AnyScenarioDef,
  opts?: RunScenarioOptions
): Promise<void> {
  if (scenario.referenceModel === undefined) {
    throw new Error(`runScenario(${scenario.id}): referenceModel is required`);
  }
  if (Object.keys(scenario.commands).length === 0) {
    throw new Error(`runScenario(${scenario.id}): commands must be non-empty`);
  }
  const maxCommands = opts?.maxCommands ?? 14;
  const modelInitial = scenario.referenceModel.initial;

  await runProperty(
    scenario.id,
    fc.asyncProperty(
      fc.tuple(arbSeed(), arbKnobs(scenario)).chain(([seed, knobs]) =>
        fc.tuple(
          fc.constant(seed),
          fc.constant(knobs),
          fc.commands(buildModelCommands(scenario, knobs), {
            maxCommands,
            size: 'small',
          })
        )
      ),
      async ([seed, knobs, cmds]) => {
        const recorded: Recorded = { commands: [] };
        const model = modelInitial() as object;
        await fc.asyncModelRun(() => ({ model, real: recorded }), cmds);

        await using world = await openWorld(scenario as never, {
          seed,
          knobs,
        });
        await world.apply(recorded.commands);
        await world.converge();

        const { world: validated } = await assertDeterministic(scenario, {
          seed,
          knobs,
          commands: recorded.commands,
        });
        await validated.dispose();
      }
    ),
    opts
  );
}

export type RunWorldPropertyOptions = {
  readonly numRuns?: number;
  readonly interruptAfterTimeLimit?: number;
};

/** Runner over custom arbitraries: opens a fresh World per sample. */
export async function runWorldProperty<Ts extends unknown[]>(
  scenario: AnyScenarioDef,
  arbs: { [K in keyof Ts]: fc.Arbitrary<Ts[K]> },
  run: (world: World, ...values: Ts) => Promise<void>,
  params?: RunWorldPropertyOptions
): Promise<void> {
  await runProperty(
    scenario.id,
    fc.asyncProperty(
      fc.tuple(arbSeed(), arbKnobs(scenario), ...arbs),
      async ([seed, knobs, ...values]) => {
        await using world = await openWorld(scenario as never, {
          seed,
          knobs,
        });
        await run(world as World, ...(values as Ts));
      }
    ),
    params
  );
}

/** A fixed Command sequence (optionally with knobs) replayed across seeds. */
export type Pin = {
  readonly name: string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly commands: readonly Command[];
};

export async function runPins(
  scenario: AnyScenarioDef,
  pins: readonly Pin[],
  opts?: RunWorldPropertyOptions
): Promise<void> {
  for (const pin of pins) {
    await runProperty(
      `${scenario.id}:${pin.name}`,
      fc.asyncProperty(arbSeed(), async (seed) => {
        const { world } = await replay(scenario, {
          seed,
          ...(pin.knobs !== undefined ? { knobs: pin.knobs } : {}),
          commands: pin.commands,
        });
        await world.dispose();
      }),
      opts
    );
  }
}
