import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import type { AnySystemDef, SystemAction } from '../define-system';
import type { JsonValue } from '../json';
import { openWorld, type World } from '../world';
import { arbKnobs, arbSeed } from './arbs';
import { assertDeterministic } from './assert-deterministic';
import { assertSampleProperty } from './assert-property';
import { replay } from './replay';

import { idsFromKnobs } from './role-ids';

type ActionReal = { actions: SystemAction[] };

function buildActionCommands(
  system: AnySystemDef,
  knobs: Record<string, JsonValue>
): fc.Arbitrary<AsyncCommand<object, ActionReal>>[] {
  const ids = idsFromKnobs(system, knobs);
  const edges = system.network?.edges ?? [];
  const ctx = { ids, knobs, edges };
  const out: fc.Arbitrary<AsyncCommand<object, ActionReal>>[] = [];

  for (const [kind, actionDef] of Object.entries(system.actions)) {
    const weight = actionDef.weight ?? 1;
    if (weight <= 0) continue;
    const allows = actionDef.allows ?? (() => true);
    const apply = actionDef.apply ?? (() => undefined);
    const cmdArb = actionDef.arb(ctx).map((action) => {
      const a = {
        ...(action as Record<string, JsonValue>),
        kind,
      } as SystemAction;
      return {
        check: (m: object) => allows(m, a as never),
        run: async (m: object, r: ActionReal) => {
          apply(m, a as never);
          r.actions.push(a);
        },
        toString: () => JSON.stringify(a),
      };
    });
    for (let i = 0; i < weight; i += 1) out.push(cmdArb);
  }

  if (out.length === 0) {
    throw new Error(`assertSample(${system.id}): actions must be non-empty`);
  }
  return out;
}

export type AssertSampleOpts = {
  readonly maxCommands?: number;
  readonly numRuns?: number;
  readonly interruptAfterTimeLimit?: number;
};

export async function assertSample(
  system: AnySystemDef,
  opts?: AssertSampleOpts
): Promise<void> {
  if (system.model === undefined) {
    throw new Error(`assertSample(${system.id}): model is required`);
  }
  if (Object.keys(system.actions).length === 0) {
    throw new Error(`assertSample(${system.id}): actions must be non-empty`);
  }
  const maxCommands = opts?.maxCommands ?? 14;
  const modelInitial = system.model.initial;

  await assertSampleProperty(
    system.id,
    fc.asyncProperty(
      fc.tuple(arbSeed(), arbKnobs(system)).chain(([seed, knobs]) =>
        fc.tuple(
          fc.constant(seed),
          fc.constant(knobs),
          fc.commands(buildActionCommands(system, knobs), {
            maxCommands,
            size: 'small',
          })
        )
      ),
      async ([seed, knobs, cmds]) => {
        const real: ActionReal = { actions: [] };
        const model = modelInitial() as object;
        await fc.asyncModelRun(() => ({ model, real }), cmds);

        await using world = await openWorld(system as never, { seed, knobs });
        await world.play(real.actions);
        await world.settle();

        const { world: validated } = await assertDeterministic(system, {
          seed,
          knobs,
          actions: real.actions,
        });
        await validated.dispose();
      }
    ),
    opts
  );
}

export type AssertWorldPropertyParams = {
  readonly numRuns?: number;
  readonly interruptAfterTimeLimit?: number;
};

export async function assertWorldProperty<Ts extends unknown[]>(
  system: AnySystemDef,
  arbs: { [K in keyof Ts]: fc.Arbitrary<Ts[K]> },
  run: (world: World, ...values: Ts) => Promise<void>,
  params?: AssertWorldPropertyParams
): Promise<void> {
  await assertSampleProperty(
    system.id,
    fc.asyncProperty(
      fc.tuple(arbSeed(), arbKnobs(system), ...arbs),
      async ([seed, knobs, ...values]) => {
        await using world = await openWorld(system as never, { seed, knobs });
        await run(world as World, ...(values as Ts));
      }
    ),
    params
  );
}

export type FaultPin = {
  readonly name: string;
  readonly knobs?: Partial<Record<string, JsonValue>>;
  readonly actions: readonly SystemAction[];
};

export async function assertPins(
  system: AnySystemDef,
  pins: readonly FaultPin[],
  opts?: AssertWorldPropertyParams
): Promise<void> {
  for (const pin of pins) {
    await assertSampleProperty(
      `${system.id}:${pin.name}`,
      fc.asyncProperty(arbSeed(), async (seed) => {
        const { world } = await replay(system, {
          seed,
          ...(pin.knobs !== undefined ? { knobs: pin.knobs } : {}),
          actions: pin.actions,
        });
        await world.dispose();
      }),
      opts
    );
  }
}
