import type { Loc, QuintEx } from '@informalsystems/quint';

export type SourceEdit = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};

/** Read each repeated field once, keeping the original lexical binding. */
export function cacheRecordFields(input: {
  readonly body: QuintEx;
  readonly parameter: string;
  readonly source: string;
  readonly sourceMap: ReadonlyMap<bigint, Loc>;
  readonly qualifier: 'pure val' | 'val';
  readonly freshName: () => string;
  readonly edits: SourceEdit[];
}): readonly string[] {
  const grouped = new Map<string, QuintEx[]>();
  for (const expression of recordFields(input.body, input.parameter)) {
    if (expression.kind !== 'app' || expression.args[1]?.kind !== 'str')
      continue;
    const field = expression.args[1].value;
    const group = grouped.get(field) ?? [];
    group.push(expression);
    grouped.set(field, group);
  }
  const bindings: string[] = [];
  for (const expressions of grouped.values()) {
    if (expressions.length < 2) continue;
    const locations = expressions.map((expression) =>
      input.sourceMap.get(expression.id)
    );
    if (locations.some((location) => location?.end === undefined)) continue;
    const first = locations[0]!;
    const name = input.freshName();
    const field = input.source.slice(first.start.index, first.end!.index + 1);
    bindings.push(`${input.qualifier} ${name} = ${field};`);
    for (const location of locations)
      input.edits.push({
        start: location!.start.index,
        end: location!.end!.index + 1,
        text: name,
      });
  }
  return bindings;
}

function recordFields(expression: QuintEx, name: string): readonly QuintEx[] {
  if (expression.kind === 'app')
    return expression.opcode === 'field' &&
      expression.args[0]?.kind === 'name' &&
      expression.args[0].name === name
      ? [expression]
      : expression.args.flatMap((argument) => recordFields(argument, name));
  if (expression.kind === 'lambda')
    return expression.params.some((parameter) => parameter.name === name)
      ? []
      : recordFields(expression.expr, name);
  if (expression.kind === 'let')
    return [
      ...recordFields(expression.opdef.expr, name),
      ...(expression.opdef.name === name
        ? []
        : recordFields(expression.expr, name)),
    ];
  return [];
}
