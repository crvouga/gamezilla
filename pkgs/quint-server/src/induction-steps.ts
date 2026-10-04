import { newIdGenerator, parsePhase1fromText } from '@informalsystems/quint';
import { inductionGuard } from './induction-guards';

/**
 * A disjunction is preserved exactly when every alternative preserves it.
 * Keep all enclosing bindings, guards and nondeterministic domains in each
 * case. An unrecognized step stays whole; never guess at its alternatives.
 */
export function inductionSteps(input: {
  readonly source: string;
  readonly module: string;
}): readonly (string | undefined)[] {
  const parsed = parsePhase1fromText(
    newIdGenerator(),
    input.source,
    'induction'
  );
  if (parsed.errors.length > 0) return [undefined];
  const module = parsed.modules.find((module) => module.name === input.module);
  const definition = module?.declarations.find(
    (declaration) => declaration.kind === 'def' && declaration.name === 'step'
  );
  if (module === undefined || definition?.kind !== 'def') return [undefined];
  let choice = definition.expr;
  while (choice.kind === 'let') choice = choice.expr;
  if (choice.kind !== 'app' || choice.opcode !== 'actionAny')
    return [undefined];
  const body = parsed.sourceMap.get(definition.expr.id);
  const span = parsed.sourceMap.get(choice.id);
  if (
    body?.end === undefined ||
    span?.end === undefined ||
    choice.args.length === 0
  )
    return [undefined];
  const suffix = input.source.slice(span.end.index + 1, body.end.index + 1);
  const alternatives = choice.args.flatMap((argument) => {
    const location = parsed.sourceMap.get(argument.id);
    if (location?.end === undefined) return [undefined];
    const selected = input.source.slice(
      location.start.index,
      location.end.index + 1
    );
    const guard = inductionGuard(argument, module);
    const cases =
      guard === undefined
        ? [selected]
        : [
            `all { ${guard}, ${selected} }`,
            `all { not(${guard}), ${selected} }`,
          ];
    return cases.map(
      (step) =>
        `{ ${input.source.slice(body.start.index, span.start.index)}${step}${suffix} }`
    );
  });
  return alternatives.some((alternative) => alternative === undefined)
    ? [undefined]
    : alternatives;
}
