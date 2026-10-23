import {
  expressionToString,
  newIdGenerator,
  parsePhase1fromText,
  type QuintEx,
  type QuintOpDef,
} from '@informalsystems/quint';

/** Distribute choices, omitting only unused draws from proven nonempty sets. */
export function temporalStep(source: string, name: string): string | undefined {
  const parsed = parsePhase1fromText(newIdGenerator(), source, 'temporal');
  if (parsed.errors.length > 0) return undefined;
  const module = parsed.modules.find((module) => module.name === name);
  const step = module?.declarations.find(
    (declaration) => declaration.kind === 'def' && declaration.name === 'step'
  );
  if (module === undefined || step?.kind !== 'def') return undefined;
  const bindings: QuintOpDef[] = [];
  let choice = step.expr;
  while (choice.kind === 'let') {
    bindings.push(choice.opdef);
    choice = choice.expr;
  }
  if (choice.kind !== 'app' || choice.opcode !== 'actionAny') return undefined;
  const nonempty = new Set(
    module.declarations.flatMap((declaration) =>
      declaration.kind === 'def' &&
      declaration.qualifier === 'pureval' &&
      !bindings.some((binding) => binding.name === declaration.name) &&
      literalNonemptySet(declaration.expr)
        ? [declaration.name]
        : []
    )
  );
  const alternatives = choice.args.map((alternative) => {
    let result = alternative;
    for (const binding of [...bindings].reverse()) {
      const draw = binding.expr;
      const domain =
        draw.kind === 'app' && draw.opcode === 'oneOf'
          ? draw.args[0]
          : undefined;
      if (
        binding.qualifier === 'nondet' &&
        domain !== undefined &&
        (literalNonemptySet(domain) ||
          (domain.kind === 'name' && nonempty.has(domain.name))) &&
        !references(result, binding.name)
      )
        continue;
      result = { kind: 'let', id: result.id, opdef: binding, expr: result };
    }
    return expressionToString(result);
  });
  return `any { ${alternatives.join(', ')} }`;
}

function literalNonemptySet(expression: QuintEx): boolean {
  return (
    expression.kind === 'app' &&
    expression.opcode === 'Set' &&
    expression.args.length > 0 &&
    expression.args.every((argument) =>
      ['int', 'str', 'bool'].includes(argument.kind)
    )
  );
}

/** Over-counting bound references is safe: it merely retains an unused draw. */
function references(expression: QuintEx, name: string): boolean {
  if (expression.kind === 'name') return expression.name === name;
  if (expression.kind === 'app')
    return (
      expression.opcode === name ||
      expression.args.some((argument) => references(argument, name))
    );
  if (expression.kind === 'lambda') return references(expression.expr, name);
  if (expression.kind === 'let')
    return (
      references(expression.opdef.expr, name) ||
      references(expression.expr, name)
    );
  return false;
}
