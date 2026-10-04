import {
  expressionToString,
  type QuintEx,
  type QuintModule,
} from '@informalsystems/quint';

/** Collect a binder-free condition, so it can also be read by the caller. */
function names(expression: QuintEx): readonly string[] | undefined {
  if (expression.kind === 'name') return [expression.name];
  if (expression.kind === 'let' || expression.kind === 'lambda')
    return undefined;
  if (expression.kind !== 'app') return [];
  const children = expression.args.map(names);
  return children.some((child) => child === undefined)
    ? undefined
    : children.flatMap((child) => child ?? []);
}

function condition(
  expression: QuintEx,
  allowed: ReadonlySet<string>
): QuintEx | undefined {
  if (expression.kind === 'let') return condition(expression.expr, allowed);
  if (expression.kind !== 'app') return undefined;
  if (expression.opcode === 'ite') {
    const candidate = expression.args[0];
    const references = candidate === undefined ? undefined : names(candidate);
    if (
      references !== undefined &&
      references.length > 0 &&
      references.every((name) => allowed.has(name))
    )
      return candidate;
  }
  for (const child of expression.args) {
    const found = condition(child, allowed);
    if (found !== undefined) return found;
  }
  return undefined;
}

function substitute(
  expression: QuintEx,
  args: ReadonlyMap<string, QuintEx>
): QuintEx {
  if (expression.kind === 'name')
    return args.get(expression.name) ?? expression;
  if (expression.kind !== 'app') return expression;
  return {
    ...expression,
    args: expression.args.map((child) => substitute(child, args)),
  };
}

/**
 * Partition a call by a total Boolean condition and its negation. The call
 * itself is unchanged, so the two cases still cover every original step.
 * Only conditions over global variables and simple caller arguments qualify.
 */
export function inductionGuard(
  expression: QuintEx,
  module: QuintModule
): string | undefined {
  if (expression.kind !== 'app') return undefined;
  const definition = module.declarations.find(
    (declaration) =>
      declaration.kind === 'def' && declaration.name === expression.opcode
  );
  if (definition?.kind === 'def' && definition.qualifier === 'action') {
    const body = definition.expr;
    const params = body.kind === 'lambda' ? body.params : [];
    const args = new Map<string, QuintEx>();
    if (params.length !== expression.args.length) return undefined;
    for (const [index, param] of params.entries()) {
      const argument = expression.args[index];
      if (argument?.kind !== 'name') return undefined;
      args.set(param.name, argument);
    }
    const globals = module.declarations.filter(
      (declaration) => declaration.kind === 'var'
    );
    const allowed = new Set([
      ...globals.map((global) => global.name),
      ...args.keys(),
    ]);
    const guard = condition(body.kind === 'lambda' ? body.expr : body, allowed);
    if (guard !== undefined) return expressionToString(substitute(guard, args));
  }
  for (const child of expression.args) {
    const found = inductionGuard(child, module);
    if (found !== undefined) return found;
  }
  return undefined;
}
