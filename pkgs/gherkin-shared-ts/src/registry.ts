/**
 * Step definitions and parameter types, matched with Cucumber Expressions.
 * One registry per process (module-global, like cucumber-js), filled by the
 * `tests/steps/**` modules a package's steps entry imports.
 */

import {
  CucumberExpression,
  ParameterType,
  ParameterTypeRegistry,
} from '@cucumber/cucumber-expressions';
import { lastSegment } from '@pkgs/os-shared-ts/slash-path';

export type StepKind = 'Given' | 'When' | 'Then' | 'Step';

/** Step body: the scenario's world first, then the expression's arguments. */
export type StepBody<W> = (world: W, ...args: never[]) => unknown;
type AnyStepBody = (world: unknown, ...args: unknown[]) => unknown;

export type StepDefinition = {
  readonly kind: StepKind;
  readonly text: string;
  readonly expression: CucumberExpression;
  readonly body: AnyStepBody;
  /** `file:line` of the definition, for failure output. */
  readonly location: string;
  /** Declared with {@link pending}: matches, but running it fails. */
  readonly pending: boolean;
};

export type ParameterTypeSpec = {
  readonly name: string;
  readonly regexp: RegExp | readonly RegExp[];
  readonly transformer: (...match: string[]) => unknown;
  readonly preferForRegexpMatch?: boolean;
};

export type ScenarioContext = {
  readonly packageName: string;
  readonly featureUri: string;
  readonly featureName: string;
  readonly scenarioName: string;
  /** 1-based line of the scenario in its feature. */
  readonly scenarioLine: number;
  readonly tags: readonly string[];
  /** Stable id for the scenario (`<feature-stem>.<scenario-slug>`). */
  readonly testId: string;
  /** The variant this run is for, when the host runs the scenario per variant. */
  readonly variant?: ScenarioVariant | undefined;
};

/**
 * One of the subjects a host runs a scenario for: the scenario runs once per
 * variant, each in a fresh world, and fails naming every variant that failed.
 * A spec never names its variants; the host derives them beside its bindings.
 */
export type ScenarioVariant = {
  /** Stable id, part of the world's test id. */
  readonly id: string;
  /** Shown in failures and reports. */
  readonly label: string;
};

/**
 * The variants of a scenario, or `null` to run it once. An empty list means
 * no registered subject offers what the scenario shows: it is not run.
 */
export type ScenarioVariants = (
  ctx: ScenarioContext
) => readonly ScenarioVariant[] | null;

export type WorldLifecycle<W> = {
  /** Select a dedicated host for these scenarios; unmatched scenarios use the default host. */
  readonly matches?: (ctx: ScenarioContext) => boolean;
  readonly create: (ctx: ScenarioContext) => Promise<W>;
  readonly dispose: (world: W) => Promise<void>;
  /** Calls the world made so far (e.g. harness calls), newest last — for reports. */
  readonly calls?: (world: W) => readonly string[];
  /**
   * A step failed: capture evidence (a screenshot, the page) before
   * {@link dispose} cleans up. Its own failure never hides the step's.
   */
  readonly failed?: (world: W, cause: unknown) => Promise<void>;
  /** Run one scenario step as a labelled step of the world's report. */
  readonly record?: <T>(
    world: W,
    step: { readonly keyword: string; readonly text: string },
    fn: () => Promise<T>
  ) => Promise<T>;
};

export type StepMatch =
  | {
      readonly kind: 'match';
      readonly definition: StepDefinition;
      readonly args: readonly unknown[];
    }
  | { readonly kind: 'undefined' }
  | {
      readonly kind: 'ambiguous';
      readonly definitions: readonly StepDefinition[];
    };

type Registry = {
  readonly parameterTypes: ParameterTypeRegistry;
  readonly parameterSpecs: ParameterTypeSpec[];
  readonly definitions: StepDefinition[];
  world: WorldLifecycle<unknown> | null;
  readonly scopedWorlds: WorldLifecycle<unknown>[];
  variants: ScenarioVariants | null;
};

const REGISTRY_KEY = Symbol.for('gherkin.registry');

function registry(): Registry {
  const host = globalThis as { [REGISTRY_KEY]?: Registry };
  host[REGISTRY_KEY] ??= {
    parameterTypes: new ParameterTypeRegistry(),
    parameterSpecs: [],
    definitions: [],
    world: null,
    scopedWorlds: [],
    variants: null,
  };
  return host[REGISTRY_KEY];
}

const PENDING = Symbol.for('gherkin.pending');

/**
 * A step whose behavior is not implemented yet. It matches (so the feature is
 * not "undefined") but running it fails, and the spec check reports it.
 */
export function pending(reason: string): StepBody<unknown> {
  const body = () => {
    throw new Error(`pending step: ${reason}`);
  };
  return Object.assign(body, { [PENDING]: true });
}

function isPending(body: unknown): boolean {
  return typeof body === 'function' && PENDING in body;
}

const HOST_LIMIT = Symbol.for('gherkin.host-limit');

/**
 * What a step throws when the host running the scenario cannot do what the
 * step asks (a harness limit, e.g. a live browser cannot cut its own
 * connection), after proving that it indeed cannot. The scenario ends there
 * and passes; the steps after it are reported skipped. Not for product
 * failures.
 */
export function hostLimit(reason: string): Error {
  return Object.assign(new Error(`host limit: ${reason}`), {
    [HOST_LIMIT]: true,
  });
}

export function isHostLimit(error: unknown): boolean {
  return typeof error === 'object' && error !== null && HOST_LIMIT in error;
}

/** `file:line` of the first stack frame outside this module. */
function callerLocation(): string {
  const stack = new Error().stack ?? '';
  const frames = stack.split('\n').slice(1);
  for (const frame of frames) {
    const match = /\(?((?:\/|[A-Za-z]:\\)[^():]+):(\d+)(?::\d+)?\)?$/.exec(
      frame.trim()
    );
    if (match === null) continue;
    const file = match[1] ?? '';
    if (lastSegment(file) === 'registry.ts') continue;
    return `${file}:${match[2] ?? '0'}`;
  }
  return 'unknown';
}

function toParameterType(spec: ParameterTypeSpec): ParameterType<unknown> {
  return new ParameterType(
    spec.name,
    spec.regexp as RegExp | RegExp[],
    null,
    spec.transformer,
    true,
    spec.preferForRegexpMatch ?? false
  );
}

/** A standalone registry from pure specs — what the static spec check uses. */
export function parameterTypeRegistryFrom(
  specs: readonly ParameterTypeSpec[]
): ParameterTypeRegistry {
  const out = new ParameterTypeRegistry();
  for (const spec of specs) out.defineParameterType(toParameterType(spec));
  return out;
}

export function defineParameterType(spec: ParameterTypeSpec): void {
  const reg = registry();
  if (reg.parameterSpecs.some((existing) => existing.name === spec.name)) {
    return;
  }
  reg.parameterSpecs.push(spec);
  reg.parameterTypes.defineParameterType(toParameterType(spec));
}

function define(kind: StepKind, text: string, body: AnyStepBody): void {
  const reg = registry();
  reg.definitions.push({
    kind,
    text,
    expression: new CucumberExpression(text, reg.parameterTypes),
    body,
    location: callerLocation(),
    pending: isPending(body),
  });
}

export type StepDefiner<W> = <A extends unknown[]>(
  text: string,
  body: (world: W, ...args: A) => unknown
) => void;

export type StepDefiners<W> = {
  readonly Given: StepDefiner<W>;
  readonly When: StepDefiner<W>;
  readonly Then: StepDefiner<W>;
  readonly Step: StepDefiner<W>;
};

/** Step definers bound to a world type. A harness exports these once. */
export function stepsFor<W>(): StepDefiners<W> {
  const definer =
    (kind: StepKind): StepDefiner<W> =>
    (text, body) =>
      define(kind, text, body as unknown as AnyStepBody);
  return {
    Given: definer('Given'),
    When: definer('When'),
    Then: definer('Then'),
    Step: definer('Step'),
  };
}

export function setWorld<W>(lifecycle: WorldLifecycle<W>): void {
  const next = lifecycle as WorldLifecycle<unknown>;
  if (lifecycle.matches === undefined) registry().world = next;
  else registry().scopedWorlds.push(next);
}

/** Run scenarios once per variant `variants` returns for them. Call once. */
export function defineScenarioVariants(variants: ScenarioVariants): void {
  const reg = registry();
  if (reg.variants !== null)
    throw new Error('gherkin: scenario variants are already defined');
  reg.variants = variants;
}

/** The variants `ctx` runs for, or `null` to run it once. */
export function scenarioVariants(
  ctx: ScenarioContext
): readonly ScenarioVariant[] | null {
  return registry().variants?.(ctx) ?? null;
}

export function worldLifecycle(ctx: ScenarioContext): WorldLifecycle<unknown> {
  const scoped = registry().scopedWorlds.filter((world) =>
    world.matches?.(ctx)
  );
  if (scoped.length > 1)
    throw new Error(`gherkin: ambiguous world for ${ctx.featureUri}`);
  const world = scoped[0] ?? registry().world;
  if (world === null) {
    throw new Error(
      'gherkin: no world — the steps entry must call setWorld() (or the harness useHarnessWorld())'
    );
  }
  return world;
}

export function stepDefinitions(): readonly StepDefinition[] {
  return registry().definitions;
}

export function parameterTypeRegistry(): ParameterTypeRegistry {
  return registry().parameterTypes;
}

export function parameterTypeSpecs(): readonly ParameterTypeSpec[] {
  return registry().parameterSpecs;
}

/** Match one step text against `definitions` (default: the registry). */
export function matchStep(
  text: string,
  definitions: readonly StepDefinition[] = stepDefinitions()
): StepMatch {
  const matches: { definition: StepDefinition; args: unknown[] }[] = [];
  for (const definition of definitions) {
    const found = definition.expression.match(text);
    if (found === null) continue;
    matches.push({
      definition,
      args: found.map((argument) => argument.getValue(null)),
    });
  }
  const first = matches[0];
  if (first === undefined) return { kind: 'undefined' };
  if (matches.length > 1) {
    return { kind: 'ambiguous', definitions: matches.map((m) => m.definition) };
  }
  return { kind: 'match', definition: first.definition, args: first.args };
}
