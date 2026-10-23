import { describe, expect, test } from 'bun:test';
import type {
  AsyncRunner,
  AsyncState,
} from '@pkgs/async-root-shared-ts/async-runner';
import { createAsyncRunner } from '@pkgs/async-root-shared-ts/async-runner';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

type Outcome =
  | { kind: 'ok'; value: number }
  | { kind: 'fail'; message: string }
  | { kind: 'abort' };

type Op = {
  readonly key: string;
  /** The model's request id at launch; stamped by {@link RunCommand}. */
  requestId: number;
  readonly settle: (o: Outcome) => void;
  readonly promise: Promise<number>;
  /** What `runner.run` returned for this op (settles after the runner's bookkeeping). */
  runnerPromise: Promise<number> | null;
};

/** Operations ignore the abort signal and settle only when a command says so. */
type Real = {
  readonly runner: AsyncRunner<number, [string]>;
  readonly ops: Op[];
  readonly pending: Op[];
};

type Model = {
  status: AsyncState<number>['status'];
  value: number | null;
  error: string | null;
  latestRequestId: number;
  live: boolean;
  /** key → index into `real.ops` of the in-flight op the runner dedupes to. */
  readonly inFlight: Map<string, number>;
  opCount: number;
};

function expectSnapshot(m: Model, r: Real): void {
  const s = r.runner.getSnapshot();
  expect(s.status).toBe(m.status);
  expect(s.value).toBe(m.value);
  expect(s.error?.message ?? null).toBe(m.error);
  expect(r.ops.length).toBe(m.opCount);
}

function setModel(m: Model, next: Partial<Model>): void {
  if (m.live) Object.assign(m, next);
}

function cancelModel(m: Model): void {
  m.latestRequestId += 1;
  m.inFlight.clear();
}

function runCommand(key: string): fc.AsyncCommand<Model, Real> {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      const p = r.runner.run(key);
      p.catch(() => undefined);
      const existing = m.inFlight.get(key);
      if (existing !== undefined) {
        expect(p).toBe(r.ops[existing]!.runnerPromise!);
      } else {
        m.latestRequestId += 1;
        const op = r.ops[m.opCount];
        if (op !== undefined) {
          op.requestId = m.latestRequestId;
          op.runnerPromise = p;
        }
        m.inFlight.set(key, m.opCount);
        m.opCount += 1;
        setModel(m, { status: 'running', error: null });
      }
      expectSnapshot(m, r);
    },
    toString: (): string => `run(${key})`,
  };
}

function settleCommand(
  pick: number,
  outcome: Outcome
): fc.AsyncCommand<Model, Real> {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      if (r.pending.length === 0) return;
      const idx = pick % r.pending.length;
      const op = r.pending[idx]!;
      r.pending.splice(idx, 1);
      op.settle(outcome);
      await op.runnerPromise?.catch(() => undefined);

      const opIndex = r.ops.indexOf(op);
      if (m.inFlight.get(op.key) === opIndex) m.inFlight.delete(op.key);
      if (op.requestId !== m.latestRequestId) {
        expectSnapshot(m, r);
        return;
      }
      const o = outcome;
      if (o.kind === 'ok') {
        setModel(m, { status: 'success', value: o.value, error: null });
      } else if (o.kind === 'fail') {
        setModel(m, { status: 'error', error: o.message });
      } else {
        setModel(m, { status: 'cancelled', error: null });
      }
      expectSnapshot(m, r);
    },
    toString: (): string => `settle(${pick}, ${JSON.stringify(outcome)})`,
  };
}

function cancelAllCommand(): fc.AsyncCommand<Model, Real> {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      r.runner.cancelAll();
      cancelModel(m);
      if (m.status === 'running') setModel(m, { status: 'cancelled' });
      expectSnapshot(m, r);
    },
    toString: (): string => 'cancelAll',
  };
}

function resetCommand(): fc.AsyncCommand<Model, Real> {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      r.runner.reset();
      cancelModel(m);
      setModel(m, { status: 'idle', value: null, error: null });
      expectSnapshot(m, r);
    },
    toString: (): string => 'reset',
  };
}

function clearErrorCommand(): fc.AsyncCommand<Model, Real> {
  return {
    check: (): boolean => true,
    async run(m: Model, r: Real): Promise<void> {
      r.runner.clearError();
      if (m.status === 'error') setModel(m, { status: 'idle', error: null });
      expectSnapshot(m, r);
    },
    toString: (): string => 'clearError',
  };
}

function disposeCommand(): fc.AsyncCommand<Model, Real> {
  return {
    check: (m: Readonly<Model>): boolean => m.live,
    async run(m: Model, r: Real): Promise<void> {
      r.runner.dispose();
      cancelModel(m);
      m.live = false;
      expectSnapshot(m, r);
    },
    toString: (): string => 'dispose',
  };
}

function createModel(): Model {
  return {
    status: 'idle',
    value: null,
    error: null,
    latestRequestId: 0,
    live: true,
    inFlight: new Map(),
    opCount: 0,
  };
}

function createReal(): Real {
  const ops: Op[] = [];
  const pending: Op[] = [];
  const runner = createAsyncRunner<number, [string]>(
    (_ctx, key) => {
      let settle: (o: Outcome) => void = () => undefined;
      const promise = new Promise<number>((resolve, reject) => {
        settle = (o) => {
          if (o.kind === 'ok') resolve(o.value);
          else if (o.kind === 'fail') reject(new Error(o.message));
          else reject(new DOMException('aborted', 'AbortError'));
        };
      });
      const op: Op = {
        key,
        requestId: 0,
        settle,
        promise,
        runnerPromise: null,
      };
      ops.push(op);
      pending.push(op);
      return promise;
    },
    { getKey: (key) => key }
  );
  return { runner, ops, pending };
}

const arbOutcome: fc.Arbitrary<Outcome> = fc.oneof(
  fc.nat({ max: 9 }).map((value) => ({ kind: 'ok', value }) as const),
  fc
    .constantFrom('e1', 'e2')
    .map((message) => ({ kind: 'fail', message }) as const),
  fc.constant({ kind: 'abort' } as const)
);

type Cmd = fc.AsyncCommand<Model, Real>;

/** Weighted toward run/settle so stale settles race newer runs of the same key. */
const arbCommand: fc.Arbitrary<Cmd> = fc.oneof(
  {
    arbitrary: fc.constantFrom('a', 'a', 'b').map((k): Cmd => runCommand(k)),
    weight: 5,
  },
  {
    arbitrary: fc
      .tuple(fc.nat({ max: 1 }), arbOutcome)
      .map(([p, o]): Cmd => settleCommand(p, o)),
    weight: 4,
  },
  { arbitrary: fc.constant<Cmd>(cancelAllCommand()), weight: 2 },
  { arbitrary: fc.constant<Cmd>(resetCommand()), weight: 1 },
  { arbitrary: fc.constant<Cmd>(clearErrorCommand()), weight: 1 },
  { arbitrary: fc.constant<Cmd>(disposeCommand()), weight: 1 }
);

const arbCommands = fc.commands([arbCommand], {
  maxCommands: 30,
  size: 'large',
});

describe('createAsyncRunner model', () => {
  test('state machine, de-duplication and staleness agree with the model', async () => {
    await assertProperty(
      'async runner model',
      fc.asyncProperty(arbCommands, async (cmds) => {
        await fc.asyncModelRun(
          () => ({ model: createModel(), real: createReal() }),
          cmds
        );
      })
    );
  });
});
