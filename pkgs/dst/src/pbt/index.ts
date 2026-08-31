import type { AsyncCommand } from 'fast-check';
import fc from 'fast-check';
import type { JsonValue } from '../json';
import { playActionsOnWorld, type SimPlayHost, type WorldReal } from '../play';
import type {
  SimFailureArtifact,
  SimScenario,
  SimScenarioInputs,
} from '../scenario';

export {
  type AssertDstOpts,
  assertDst,
  assertDstFaultPins,
  type FaultPin,
  type ReplayDstInputs,
  replayDst,
} from './assert-dst';
export {
  type AssertDstPropertyParams,
  arbFromKnobDefs,
  arbWorldSeed,
  assertDstProperty,
} from './assert-property';

export function actionCommand<
  Model extends object,
  Action extends JsonValue,
>(args: {
  readonly action: Action;
  readonly allows: (m: Model, a: Action) => boolean;
  readonly apply: (m: Model, a: Action) => void;
}): AsyncCommand<Model, WorldReal<Action>> {
  return {
    check: (m) => args.allows(m, args.action),
    run: async (m, r) => {
      args.apply(m, args.action);
      r.actions.push(args.action);
    },
    toString: () => JSON.stringify(args.action),
  };
}

export type RunCommandsOnWorldResult<
  Action extends JsonValue,
  K extends Record<string, JsonValue>,
> = {
  readonly actions: readonly Action[];
  readonly scenario: SimScenario<Action, K>;
};

export async function runCommandsOnWorld<
  Model extends object,
  Action extends JsonValue,
  K extends Record<string, JsonValue>,
>(args: {
  readonly host: SimPlayHost;
  readonly initialModel: () => Model;
  readonly cmds: Iterable<AsyncCommand<Model, WorldReal<Action>>>;
  readonly dispatch: (action: Action) => Promise<void>;
  readonly prepareConverge?: () => Promise<void>;
  readonly settle?: boolean;
  readonly scenarioBase: Omit<SimScenarioInputs<Action, K>, 'actions'>;
}): Promise<RunCommandsOnWorldResult<Action, K>> {
  const real: WorldReal<Action> = {
    clientIds: [],
    actions: [],
  };
  const model = args.initialModel();
  await fc.asyncModelRun(() => ({ model, real }), args.cmds);
  try {
    await playActionsOnWorld({
      host: args.host,
      actions: real.actions,
      dispatch: args.dispatch,
      ...(args.prepareConverge !== undefined
        ? { prepareConverge: args.prepareConverge }
        : {}),
    });
    if (args.settle !== false && args.host.assertConverged !== undefined) {
      await args.host.assertConverged();
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    const scenario: SimScenario<Action, K> = {
      version: 1,
      inputs: {
        ...args.scenarioBase,
        actions: real.actions,
      },
      meta: {
        error,
        seedHex: args.host.seed.toString(16),
        failureStep: real.actions.length,
      },
    };
    const artifact: SimFailureArtifact = {
      scenario,
      trace: args.host.trace?.events() ?? [],
      error,
    };
    const err = new Error(error);
    (err as Error & { artifact: SimFailureArtifact }).artifact = artifact;
    throw err;
  }
  const scenario: SimScenario<Action, K> = {
    version: 1,
    inputs: {
      ...args.scenarioBase,
      actions: real.actions,
    },
    meta: {
      seedHex: args.host.seed.toString(16),
    },
  };
  return { actions: real.actions, scenario };
}

export type { AssertDstPropertyParams as DstAssertParams } from './assert-property';
export { fc };
