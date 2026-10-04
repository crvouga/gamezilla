import {
  expressionToString,
  newIdGenerator,
  parsePhase1fromText,
  type QuintEx,
} from '@informalsystems/quint';
import { frameExpression } from './frame-expression';

type FrameInput = {
  readonly source: string;
  readonly module: string;
  readonly candidate: string;
  readonly step: string;
};

/** A candidate conjunct over variables assigned back to themselves is preserved structurally. */
export function preservationTargets(input: FrameInput): readonly string[] {
  const parsed = parsePhase1fromText(newIdGenerator(), input.source, 'frame');
  const module = parsed.modules.find((item) => item.name === input.module);
  const step = parsePhase1fromText(
    newIdGenerator(),
    `module frame_step { action step = ${input.step} }`,
    'frame-step'
  );
  const action = step.modules[0]?.declarations[0];
  const candidate = module?.declarations.find(
    (item) => item.kind === 'def' && item.name === input.candidate
  );
  if (
    parsed.errors.length > 0 ||
    step.errors.length > 0 ||
    module === undefined ||
    action?.kind !== 'def' ||
    candidate?.kind !== 'def'
  )
    return [input.candidate];
  try {
    const expand = frameExpression(module);
    const kept = unchanged(expand(action.expr, true));
    const variables = new Set(
      module.declarations.flatMap((item) =>
        item.kind === 'var' ? [item.name] : []
      )
    );
    const definitions = new Map(
      module.declarations.flatMap((item) =>
        item.kind === 'def' ? [[item.name, item.expr]] : []
      )
    );
    return conjuncts(candidate.expr, definitions)
      .filter((expression) =>
        references(expand(expression), variables).some(
          (name) => !kept.has(name)
        )
      )
      .map(expressionToString);
  } catch {
    return [input.candidate];
  }
}

function intersect(sets: readonly ReadonlySet<string>[]): Set<string> {
  return new Set(
    [...(sets[0] ?? [])].filter((name) => sets.every((set) => set.has(name)))
  );
}

function unchanged(
  expression: QuintEx,
  facts: ReadonlyMap<string, boolean> = new Map()
): Set<string> {
  if (expression.kind !== 'app') return new Set();
  if (expression.opcode === 'assign') {
    const [left, right] = expression.args;
    return left?.kind === 'name' &&
      right?.kind === 'name' &&
      left.name === right.name
      ? new Set([left.name])
      : new Set();
  }
  if (expression.opcode === 'actionAll' || expression.opcode === 'and') {
    const next = conjunctionFacts(expression.args, facts);
    return new Set(
      expression.args.flatMap((argument) => [...unchanged(argument, next)])
    );
  }
  if (expression.opcode === 'actionAny' || expression.opcode === 'or')
    return intersect(
      expression.args.map((argument) => unchanged(argument, facts))
    );
  if (expression.opcode === 'ite') {
    const condition = expression.args[0];
    const known =
      condition === undefined
        ? undefined
        : facts.get(expressionToString(condition));
    return known === undefined
      ? intersect(
          expression.args.slice(1).map((argument) => unchanged(argument, facts))
        )
      : unchanged(expression.args[known ? 1 : 2]!, facts);
  }
  return new Set();
}

function conjunctionFacts(
  expressions: readonly QuintEx[],
  facts: ReadonlyMap<string, boolean>
): ReadonlyMap<string, boolean> {
  const next = new Map(facts);
  for (const expression of expressions) {
    if (hasAssignment(expression)) continue;
    if (
      expression.kind === 'app' &&
      expression.opcode === 'not' &&
      expression.args[0] !== undefined
    )
      next.set(expressionToString(expression.args[0]), false);
    else next.set(expressionToString(expression), true);
  }
  return next;
}

function children(expression: QuintEx): readonly QuintEx[] {
  if (expression.kind === 'app') return expression.args;
  if (expression.kind === 'lambda') return [expression.expr];
  return [];
}

function hasAssignment(expression: QuintEx): boolean {
  return (
    (expression.kind === 'app' && expression.opcode === 'assign') ||
    children(expression).some(hasAssignment)
  );
}

function references(
  expression: QuintEx,
  variables: ReadonlySet<string>
): readonly string[] {
  return expression.kind === 'name' && variables.has(expression.name)
    ? [expression.name]
    : children(expression).flatMap((child) => references(child, variables));
}

function conjuncts(
  expression: QuintEx,
  definitions: ReadonlyMap<string, QuintEx>,
  seen: ReadonlySet<string> = new Set()
): readonly QuintEx[] {
  if (expression.kind === 'name') {
    const body = definitions.get(expression.name);
    if (
      body?.kind === 'app' &&
      (body.opcode === 'actionAll' || body.opcode === 'and')
    ) {
      if (seen.has(expression.name)) throw new Error('recursive candidate');
      return conjuncts(body, definitions, new Set([...seen, expression.name]));
    }
  }
  return expression.kind === 'app' &&
    (expression.opcode === 'actionAll' || expression.opcode === 'and')
    ? expression.args.flatMap((argument) =>
        conjuncts(argument, definitions, seen)
      )
    : [expression];
}
