import type { JsonValue } from './json';
import type { SimTrace } from './trace';

export type InvariantViolation = {
  readonly invariant: string;
  readonly detail: string;
};

export type DomainModelHooks<Model, Op> = {
  readonly initial: () => Model;
  readonly allows: (model: Model, op: Op) => boolean;
  readonly apply: (model: Model, op: Op) => void;
  readonly clientAllows?: (
    model: Model,
    op: Op,
    clientLive: boolean
  ) => boolean;
  readonly onHeal?: (model: Model) => void;
};

export type WorldReal<Action extends JsonValue> = {
  readonly clientIds: readonly string[];
  actions: Action[];
};

/** Control ports only — no domain state, SQL, clients, or product APIs. */
export type SimPlayHost = {
  readonly seed: bigint;
  readonly runFor: (ms: number) => Promise<void>;
  readonly checkInvariants: () => Promise<InvariantViolation | null>;
  readonly clearBoundaryFaults?: () => void;
  readonly assertConverged?: () => Promise<void>;
  readonly trace?: SimTrace;
};

export type PlayActionsOnWorldArgs<Action extends JsonValue> = {
  readonly host: SimPlayHost;
  readonly actions: readonly Action[];
  readonly dispatch: (action: Action) => Promise<void>;
  readonly prepareAction?: (action: Action) => Promise<void>;
  readonly prepareConverge?: () => Promise<void>;
  readonly stepIdleMs?: number;
};

export async function playActionsOnWorld<Action extends JsonValue>(
  args: PlayActionsOnWorldArgs<Action>
): Promise<void> {
  const stepIdleMs = args.stepIdleMs ?? 10;
  const { host } = args;
  for (let index = 0; index < args.actions.length; index += 1) {
    const action = args.actions[index]!;
    if (host.trace?.enabled) {
      host.trace.record({
        now: 0,
        type: 'step',
        index,
        action,
      });
    }
    if (args.prepareAction !== undefined) {
      await args.prepareAction(action);
    }
    await args.dispatch(action);
    const inv = await host.checkInvariants();
    if (inv !== null) {
      throw new Error(
        `${inv.invariant} seed=${host.seed.toString(16)}: ${inv.detail}`
      );
    }
    await host.runFor(stepIdleMs);
  }
  if (args.prepareConverge !== undefined) {
    await args.prepareConverge();
  }
}
